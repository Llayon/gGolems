import bpy
import json
import pathlib
import sys
from mathutils import Matrix, Vector


SOURCE_ARMATURE_NAME = "Armature"
OUTPUT_GLB = "src/assets/mechs/KWII_detailed_skinned_export.glb"
OUTPUT_BLEND = "docs/blender_exports/KWII_detailed_skinned_export.blend"
RUNTIME_ACTIONS = {
    "00-keying": "KWII_Idle",
    "00-keying_1": "KWII_Fire",
    "01-walk": "KWII_Walk",
}
SOCKETS = (
    ("viewAnchor", "DEF-CAMERAS-BASE", Vector((0.0, 0.0, 0.0))),
    ("leftArmMount", "DEF-CANON.L", Vector((0.0, 0.22, 0.0))),
    ("rightArmMount", "DEF-CANON.R", Vector((0.0, 0.22, 0.0))),
    ("torsoMount", "DEF-UPPER-BODY", Vector((0.0, 0.18, 0.12))),
)


def resolve_path(value: str) -> pathlib.Path:
    path = pathlib.Path(value)
    if not path.is_absolute():
        path = pathlib.Path(bpy.path.abspath("//")) / path
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def get_armature() -> bpy.types.Object:
    armature = bpy.data.objects.get(SOURCE_ARMATURE_NAME)
    if armature is None or armature.type != "ARMATURE":
        raise RuntimeError(f"Missing armature: {SOURCE_ARMATURE_NAME}")
    return armature


def collect_meshes(armature: bpy.types.Object) -> list[bpy.types.Object]:
    meshes = []
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        if not obj.name.endswith("_low"):
            continue
        if obj.name.startswith("WGT-"):
            continue
        armature_modifier = next(
            (modifier for modifier in obj.modifiers if modifier.type == "ARMATURE"),
            None,
        )
        if armature_modifier is None or armature_modifier.object != armature:
            continue
        meshes.append(obj)
    return sorted(meshes, key=lambda obj: obj.name)


def duplicate_armature(armature: bpy.types.Object) -> bpy.types.Object:
    armature_copy = armature.copy()
    armature_copy.data = armature.data.copy()
    armature_copy.name = "KWII_DetailedSkinnedRig"
    bpy.context.scene.collection.objects.link(armature_copy)
    armature_copy.matrix_world = armature.matrix_world.copy()
    armature_copy.hide_set(False)
    armature_copy.hide_viewport = False
    armature_copy.hide_render = False
    return armature_copy


def duplicate_meshes(source_meshes: list[bpy.types.Object], armature_copy: bpy.types.Object) -> list[bpy.types.Object]:
    duplicates = []
    for source_obj in source_meshes:
        duplicate = source_obj.copy()
        duplicate.data = source_obj.data.copy()
        duplicate.name = f"{source_obj.name}_skinned"
        bpy.context.scene.collection.objects.link(duplicate)
        duplicate.matrix_world = source_obj.matrix_world.copy()
        duplicate.parent = armature_copy
        for modifier in duplicate.modifiers:
            if modifier.type == "ARMATURE":
                modifier.object = armature_copy
            if modifier.type == "NODES":
                modifier.show_viewport = False
                modifier.show_render = False
        duplicate.hide_set(False)
        duplicate.hide_viewport = False
        duplicate.hide_render = False
        duplicates.append(duplicate)
    return duplicates


def clear_armature_actions(armature: bpy.types.Object) -> None:
    armature.animation_data_create()
    armature.animation_data.action = None
    if armature.animation_data.nla_tracks:
        for track in list(armature.animation_data.nla_tracks):
            armature.animation_data.nla_tracks.remove(track)


def build_runtime_actions(source_armature: bpy.types.Object, target_armature: bpy.types.Object) -> list[str]:
    clear_armature_actions(target_armature)
    source_armature.animation_data_create()
    target_armature.animation_data_create()
    built_actions: list[str] = []

    for source_name, target_name in RUNTIME_ACTIONS.items():
        source_action = bpy.data.actions.get(source_name)
        if source_action is None:
            continue
        action_copy = source_action.copy()
        action_copy.name = target_name
        action_copy.use_fake_user = True
        built_actions.append(target_name)

    if "KWII_Idle" in built_actions and "KWII_TorsoTurn" not in built_actions:
        idle_action = bpy.data.actions.get("KWII_Idle")
        if idle_action is not None:
            torso_turn = idle_action.copy()
            torso_turn.name = "KWII_TorsoTurn"
            torso_turn.use_fake_user = True
            built_actions.append("KWII_TorsoTurn")

    keep = set(built_actions)
    for action in list(bpy.data.actions):
        if action.name in keep:
            continue
        bpy.data.actions.remove(action)

    return built_actions


def add_socket_objects(armature_copy: bpy.types.Object) -> list[bpy.types.Object]:
    socket_objects = []
    armature_matrix = armature_copy.matrix_world.copy()
    for socket_name, bone_name, local_offset in SOCKETS:
        bone = armature_copy.pose.bones.get(bone_name)
        if bone is None:
            raise RuntimeError(f"Missing socket bone: {bone_name}")
        socket = bpy.data.objects.new(socket_name, None)
        socket.empty_display_type = "PLAIN_AXES"
        socket.empty_display_size = 0.12
        socket.parent = armature_copy
        socket.parent_type = "BONE"
        socket.parent_bone = bone_name
        socket.matrix_parent_inverse = Matrix.Identity(4)
        socket.location = local_offset
        socket.rotation_euler = (0.0, 0.0, 0.0)
        socket.scale = (1.0, 1.0, 1.0)
        bpy.context.scene.collection.objects.link(socket)
        socket.matrix_world = armature_matrix @ bone.matrix @ Matrix.Translation(local_offset)
        socket_objects.append(socket)
    return socket_objects


def write_json(path: pathlib.Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def export_glb(output_path: pathlib.Path, armature_copy: bpy.types.Object, mesh_objects: list[bpy.types.Object], socket_objects: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    armature_copy.select_set(True)
    for obj in mesh_objects:
        obj.select_set(True)
    for obj in socket_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = armature_copy

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
        export_materials="PLACEHOLDER",
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
        export_def_bones=True,
        export_leaf_bone=False,
        export_lights=False,
        export_cameras=False,
    )


def save_blend_copy(path: pathlib.Path) -> None:
    bpy.ops.wm.save_as_mainfile(filepath=str(path), copy=True)


def main() -> None:
    argv = sys.argv
    args = argv[argv.index("--") + 1 :] if "--" in argv else []
    output_glb = resolve_path(args[0] if args else OUTPUT_GLB)
    output_blend = resolve_path(args[1] if len(args) > 1 else OUTPUT_BLEND)

    source_armature = get_armature()
    source_meshes = collect_meshes(source_armature)
    if not source_meshes:
        raise RuntimeError("No source *_low meshes found")

    armature_copy = duplicate_armature(source_armature)
    mesh_copies = duplicate_meshes(source_meshes, armature_copy)
    actions = build_runtime_actions(source_armature, armature_copy)
    socket_objects = add_socket_objects(armature_copy)

    manifest = {
        "armature": armature_copy.name,
        "meshCount": len(mesh_copies),
        "socketNames": [obj.name for obj in socket_objects],
        "actions": actions,
    }
    materials = {
        obj.name: [slot.material.name if slot.material else None for slot in obj.material_slots]
        for obj in mesh_copies
    }

    write_json(output_glb.with_suffix(".export.json"), manifest)
    write_json(output_glb.with_suffix(".materials.json"), materials)
    export_glb(output_glb, armature_copy, mesh_copies, socket_objects)
    save_blend_copy(output_blend)

    print(
        "EXPORTED",
        {
            "glb": str(output_glb),
            "blend": str(output_blend),
            "meshCount": len(mesh_copies),
            "actions": actions,
        },
    )


main()
