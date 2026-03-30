import bpy
import json
import pathlib
import sys


"""
Export the cleaned KWII runtime rig scene to a game-ready GLB.

Supported source scenes:
- The already cleaned rigid runtime scene built around `KWII_RuntimeRig_Export`.
- A future dedicated game rig scene such as `KWII_GameRig`.

The script exports:
- the armature
- rigid bone-parented or skinned mesh objects
- runtime sockets (`viewAnchor`, `leftArmMount`, `rightArmMount`, `torsoMount`)
- baked action clips
"""


GAME_RIG_CANDIDATES = ("KWII_RuntimeRig_Export", "KWII_GameRig", "KWII_RuntimeRig_Game")
OUTPUT_PATH = "src/assets/mechs/KWII_runtime_rigid.glb"

RUNTIME_BONE_PROFILES = {
    "runtime_export": (
        "Root",
        "Pelvis",
        "Waist",
        "Torso",
        "Head",
        "Arm.L",
        "Arm.R",
        "Gun.L",
        "Gun.R",
        "Thigh.L",
        "Thigh.R",
        "Shin.L",
        "Shin.R",
        "Foot.L",
        "Foot.R",
    ),
    "game_def": (
        "DEF-HIPS",
        "DEF-BODY",
        "DEF-UPPER-BODY",
        "DEF-CAMERAS-BASE",
        "DEF-ARM.L",
        "DEF-ARM.R",
        "DEF-CANON.L",
        "DEF-CANON.R",
        "DEF-LEG.L",
        "DEF-LEG.R",
        "DEF-SHIN.L",
        "DEF-SHIN.R",
        "DEF-FOOT-ALONG-Y.L",
        "DEF-FOOT-ALONG-Y.R",
    ),
}

SOCKET_SPECS = {
    "viewAnchor": {
        "source_object": "viewAnchor",
        "fallback_bones": ("Head", "DEF-CAMERAS-BASE"),
    },
    "leftArmMount": {
        "source_object": "leftArmMount",
        "fallback_bones": ("Gun.L", "DEF-CANON.L", "DEF-MINIGUN.L"),
    },
    "rightArmMount": {
        "source_object": "rightArmMount",
        "fallback_bones": ("Gun.R", "DEF-CANON.R", "DEF-MINIGUN.R"),
    },
    "torsoMount": {
        "source_object": "torsoMount",
        "fallback_bones": ("Torso", "DEF-UPPER-BODY"),
    },
}

RUNTIME_ACTION_NAMES = (
    "KWII_Idle",
    "KWII_Walk",
    "KWII_Fire",
    "KWII_TorsoTurn",
)

HELPER_PREFIXES = ("CTRL-", "TGT-", "WGT-", "IK-", "FK-")
HELPER_CONTAINS = ("MCH-",)


def resolve_output_path(output_arg: str) -> pathlib.Path:
    output_path = pathlib.Path(output_arg)
    if not output_path.is_absolute():
        output_path = pathlib.Path(bpy.path.abspath("//")) / output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)
    return output_path


def find_game_rig() -> bpy.types.Object:
    for name in GAME_RIG_CANDIDATES:
        rig = bpy.data.objects.get(name)
        if rig is not None and rig.type == "ARMATURE":
            return rig

    raise RuntimeError(
        "Missing KWII runtime armature. Expected one of: "
        + ", ".join(GAME_RIG_CANDIDATES)
    )


def collect_mesh_objects(rig: bpy.types.Object) -> list[bpy.types.Object]:
    mesh_objects: list[bpy.types.Object] = []

    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue

        armature_modifier = next(
            (modifier for modifier in obj.modifiers if modifier.type == "ARMATURE"),
            None,
        )
        if armature_modifier is not None and armature_modifier.object == rig:
            mesh_objects.append(obj)
            continue

        if obj.parent == rig and obj.parent_type == "BONE" and obj.parent_bone:
            mesh_objects.append(obj)

    return sorted(mesh_objects, key=lambda obj: obj.name)


def validate_runtime_bones(rig: bpy.types.Object) -> tuple[str, tuple[str, ...]]:
    bone_names = {bone.name for bone in rig.data.bones}

    unexpected_helpers = sorted(
        bone.name
        for bone in rig.data.bones
        if bone.name.startswith(HELPER_PREFIXES) or any(token in bone.name for token in HELPER_CONTAINS)
    )
    if unexpected_helpers:
        raise RuntimeError(
            "Runtime rig still contains helper/control bones: "
            + ", ".join(unexpected_helpers[:24])
            + (" ..." if len(unexpected_helpers) > 24 else "")
        )

    for profile_name, required_bones in RUNTIME_BONE_PROFILES.items():
        if all(name in bone_names for name in required_bones):
            return profile_name, required_bones

    missing_by_profile = {
        profile_name: [name for name in required_bones if name not in bone_names]
        for profile_name, required_bones in RUNTIME_BONE_PROFILES.items()
    }
    raise RuntimeError(
        "Runtime rig does not match any supported bone profile: "
        + json.dumps(missing_by_profile, ensure_ascii=False)
    )


def warn_missing_runtime_actions() -> None:
    available_actions = {action.name for action in bpy.data.actions}
    missing_actions = [name for name in RUNTIME_ACTION_NAMES if name not in available_actions]
    if missing_actions:
        print("WARNING Missing expected runtime actions:", missing_actions)


def disable_nodes_modifiers(mesh_objects: list[bpy.types.Object]) -> None:
    for obj in mesh_objects:
        for modifier in obj.modifiers:
            if modifier.type == "NODES":
                modifier.show_viewport = False
                modifier.show_render = False


def create_fallback_socket(
    scene_collection: bpy.types.Collection,
    rig: bpy.types.Object,
    socket_name: str,
    fallback_bone_name: str,
) -> bpy.types.Object:
    socket = bpy.data.objects.new(socket_name, None)
    socket.empty_display_type = "PLAIN_AXES"
    socket.empty_display_size = 0.18
    socket.parent = rig
    socket.parent_type = "BONE"
    socket.parent_bone = fallback_bone_name
    socket.matrix_parent_inverse.identity()
    socket.location = (0.0, 0.0, 0.0)
    socket.rotation_mode = "XYZ"
    socket.rotation_euler = (0.0, 0.0, 0.0)
    socket.scale = (1.0, 1.0, 1.0)
    scene_collection.objects.link(socket)
    return socket


def prepare_socket_exports(
    rig: bpy.types.Object,
) -> tuple[list[bpy.types.Object], list[str]]:
    export_objects: list[bpy.types.Object] = []
    created_objects: list[bpy.types.Object] = []
    socket_names: list[str] = []
    bone_names = {bone.name for bone in rig.data.bones}

    for socket_name, socket_spec in SOCKET_SPECS.items():
        socket_names.append(socket_name)
        source_socket = bpy.data.objects.get(socket_spec["source_object"])
        if source_socket is not None:
            socket_copy = source_socket.copy()
            socket_copy.data = None
            socket_copy.name = socket_name
            bpy.context.scene.collection.objects.link(socket_copy)
            created_objects.append(socket_copy)
            export_objects.append(socket_copy)
            continue

        fallback_bone_name = next(
            (bone_name for bone_name in socket_spec["fallback_bones"] if bone_name in bone_names),
            None,
        )
        if fallback_bone_name is None:
            raise RuntimeError(
                f"Cannot create fallback socket {socket_name}: no fallback bone exists"
            )

        fallback_socket = create_fallback_socket(
            bpy.context.scene.collection,
            rig,
            socket_name,
            fallback_bone_name,
        )
        created_objects.append(fallback_socket)
        export_objects.append(fallback_socket)

    return export_objects, socket_names, created_objects


def cleanup_temporary_objects(objects: list[bpy.types.Object]) -> None:
    for obj in objects:
        bpy.data.objects.remove(obj, do_unlink=True)


def write_material_map(output_path: pathlib.Path, mesh_objects: list[bpy.types.Object]) -> pathlib.Path:
    material_map_path = output_path.with_suffix(".materials.json")
    material_map = {
        obj.name: obj.material_slots[0].material.name
        for obj in mesh_objects
        if obj.material_slots and obj.material_slots[0].material is not None
    }
    material_map_path.write_text(json.dumps(material_map, indent=2), encoding="utf-8")
    return material_map_path


def write_export_manifest(
    output_path: pathlib.Path,
    rig: bpy.types.Object,
    profile_name: str,
    mesh_objects: list[bpy.types.Object],
    socket_names: list[str],
) -> pathlib.Path:
    manifest_path = output_path.with_suffix(".export.json")
    manifest = {
        "armature": rig.name,
        "boneProfile": profile_name,
        "boneNames": [bone.name for bone in rig.data.bones],
        "meshObjects": [obj.name for obj in mesh_objects],
        "socketObjects": socket_names,
        "actions": sorted(action.name for action in bpy.data.actions if action.name in RUNTIME_ACTION_NAMES),
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest_path


def export_glb(
    output_path: pathlib.Path,
    rig: bpy.types.Object,
    mesh_objects: list[bpy.types.Object],
    socket_objects: list[bpy.types.Object],
) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for obj in mesh_objects:
        obj.select_set(True)
    for obj in socket_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig

    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        use_visible=False,
        export_yup=True,
        export_apply=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_frame_range=False,
        export_anim_slide_to_zero=True,
        export_optimize_animation_size=True,
        export_anim_single_armature=True,
        export_current_frame=False,
        export_rest_position_armature=False,
        export_skins=True,
        export_influence_nb=4,
        export_all_influences=False,
        export_def_bones=False,
        export_leaf_bone=False,
        export_lights=False,
        export_cameras=False,
    )


def main() -> None:
    argv = sys.argv
    export_args = argv[argv.index("--") + 1 :] if "--" in argv else []
    output_arg = export_args[0] if export_args else OUTPUT_PATH
    output_path = resolve_output_path(output_arg)

    rig = find_game_rig()
    rig.hide_set(False)
    rig.hide_viewport = False
    rig.hide_render = False

    profile_name, _ = validate_runtime_bones(rig)
    warn_missing_runtime_actions()

    mesh_objects = collect_mesh_objects(rig)
    if not mesh_objects:
        raise RuntimeError(
            f"No runtime mesh objects were found for rig: {rig.name}"
        )

    disable_nodes_modifiers(mesh_objects)
    material_map_path = write_material_map(output_path, mesh_objects)

    socket_objects, socket_names, created_socket_objects = prepare_socket_exports(rig)

    try:
        export_glb(output_path, rig, mesh_objects, socket_objects)
    finally:
        cleanup_temporary_objects(created_socket_objects)

    manifest_path = write_export_manifest(output_path, rig, profile_name, mesh_objects, socket_names)

    print(
        "EXPORTED",
        {
            "output": str(output_path),
            "rig": rig.name,
            "profile": profile_name,
            "meshCount": len(mesh_objects),
            "materialMap": str(material_map_path),
            "manifest": str(manifest_path),
            "sockets": socket_names,
        },
    )


main()
