import bpy
import json
import pathlib
import sys
from mathutils import Vector


SOURCE_ARMATURE_NAME = "Armature"
OUTPUT_GLB = "src/assets/mechs/KWII_detailed_game_export.glb"
OUTPUT_BLEND = "docs/blender_exports/KWII_detailed_game_export.blend"
COLLECTION_NAME = "KWII_DetailedGameExport"

ACTION_NAME_MAP = {
    "00-keying": "KWII_Idle",
    "00-keying_1": "KWII_Fire",
    "01-walk": "KWII_Walk",
}

TARGET_BONES = (
    ("Root", None, None),
    ("Pelvis", "Root", "DEF-HIPS"),
    ("Waist", "Pelvis", "DEF-BODY"),
    ("Torso", "Waist", "DEF-UPPER-BODY"),
    ("Head", "Torso", "DEF-CAMERAS-BASE"),
    ("Arm.L", "Torso", "DEF-ARM.L"),
    ("Gun.L", "Arm.L", "DEF-CANON.L"),
    ("Arm.R", "Torso", "DEF-ARM.R"),
    ("Gun.R", "Arm.R", "DEF-CANON.R"),
    ("Thigh.L", "Pelvis", "DEF-LEG.L"),
    ("Shin.L", "Thigh.L", "DEF-SHIN.L"),
    ("Foot.L", "Shin.L", "DEF-FOOT-ALONG-Y.L"),
    ("Thigh.R", "Pelvis", "DEF-LEG.R"),
    ("Shin.R", "Thigh.R", "DEF-SHIN.R"),
    ("Foot.R", "Shin.R", "DEF-FOOT-ALONG-Y.R"),
)

SOCKETS = (
    ("viewAnchor", "Head", Vector((0.0, 0.0, 0.0))),
    ("leftArmMount", "Gun.L", Vector((0.0, 0.22, 0.0))),
    ("rightArmMount", "Gun.R", Vector((0.0, 0.22, 0.0))),
    ("torsoMount", "Torso", Vector((0.0, 0.18, 0.12))),
)


def resolve_output_path(arg_value: str) -> pathlib.Path:
    path = pathlib.Path(arg_value)
    if not path.is_absolute():
        path = pathlib.Path(bpy.path.abspath("//")) / path
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def resolve_blend_path(export_path: pathlib.Path, arg_value: str | None) -> pathlib.Path:
    default_path = pathlib.Path(arg_value) if arg_value else pathlib.Path(OUTPUT_BLEND)
    if not default_path.is_absolute():
        default_path = pathlib.Path(bpy.path.abspath("//")) / default_path
    default_path.parent.mkdir(parents=True, exist_ok=True)
    return default_path


def get_source_armature() -> bpy.types.Object:
    armature = bpy.data.objects.get(SOURCE_ARMATURE_NAME)
    if armature is None or armature.type != "ARMATURE":
        raise RuntimeError(f"Missing source armature: {SOURCE_ARMATURE_NAME}")
    return armature


def collect_source_meshes(source_armature: bpy.types.Object) -> list[bpy.types.Object]:
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
        if armature_modifier is None or armature_modifier.object != source_armature:
            continue
        meshes.append(obj)
    return sorted(meshes, key=lambda obj: obj.name)


def ensure_collection(name: str) -> bpy.types.Collection:
    existing = bpy.data.collections.get(name)
    if existing is not None:
        for obj in list(existing.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        for child in list(existing.children):
            existing.children.unlink(child)
        return existing

    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    return collection


def source_bone(name: str, source_armature: bpy.types.Object):
    bone = source_armature.data.bones.get(name)
    if bone is None:
        raise RuntimeError(f"Missing source bone: {name}")
    return bone


def create_runtime_armature(
    source_armature: bpy.types.Object,
    collection: bpy.types.Collection,
) -> bpy.types.Object:
    armature_data = bpy.data.armatures.new("KWII_DetailedGameRig_Data")
    armature_obj = bpy.data.objects.new("KWII_DetailedGameRig", armature_data)
    armature_obj.matrix_world = source_armature.matrix_world.copy()
    collection.objects.link(armature_obj)

    bpy.context.view_layer.objects.active = armature_obj
    bpy.ops.object.mode_set(mode="EDIT")
    edit_bones = armature_data.edit_bones

    for target_name, parent_name, source_name in TARGET_BONES:
        edit_bone = edit_bones.new(target_name)
        if source_name is None:
            hips = source_bone("DEF-HIPS", source_armature)
            edit_bone.head = hips.head_local.copy()
            edit_bone.tail = hips.head_local + Vector((0.0, 0.2, 0.0))
        else:
            src = source_bone(source_name, source_armature)
            edit_bone.head = src.head_local.copy()
            edit_bone.tail = src.tail_local.copy()
            if (edit_bone.tail - edit_bone.head).length < 0.01:
                edit_bone.tail = edit_bone.head + Vector((0.0, 0.12, 0.0))
        edit_bone.use_connect = False

    for target_name, parent_name, _source_name in TARGET_BONES:
        if not parent_name:
            continue
        edit_bones[target_name].parent = edit_bones[parent_name]

    bpy.ops.object.mode_set(mode="OBJECT")
    return armature_obj


def map_source_bone_to_target(source_name: str) -> str | None:
    if source_name == "DEF-HIPS":
        return "Pelvis"
    if source_name == "DEF-BODY":
        return "Waist"
    if source_name == "DEF-UPPER-BODY":
        return "Torso"
    if source_name.startswith("DEF-CAMERAS") or source_name.startswith("DEF-EAR"):
        return "Head"
    if source_name.startswith("DEF-ARM-CYL-") and source_name.endswith(".L"):
        return "Arm.L"
    if source_name.startswith("DEF-ARM-CYL-") and source_name.endswith(".R"):
        return "Arm.R"
    if source_name == "DEF-ARM.L":
        return "Arm.L"
    if source_name == "DEF-ARM.R":
        return "Arm.R"
    if (
        source_name.startswith("DEF-MINIGUN")
        or source_name.startswith("DEF-CANON")
        or source_name.startswith("DEF-BELT-")
        or source_name.startswith("DEF-ARM-WIRE-")
    ):
        return "Gun.L" if source_name.endswith(".L") else "Gun.R"
    if source_name.startswith("DEF-BODY-CYL") or source_name.startswith("DEF-NOZZLE") or source_name.startswith("DEF-BODY-FLAP") or source_name.startswith("DEF-BODY-PISTON"):
        return "Torso"
    if source_name == "DEF-LEG.L":
        return "Thigh.L"
    if source_name == "DEF-LEG.R":
        return "Thigh.R"
    if source_name.startswith("DEF-KNEE") or source_name.startswith("DEF-SHIN"):
        return "Shin.L" if source_name.endswith(".L") else "Shin.R"
    if source_name.startswith("DEF-FOOT") or source_name.startswith("DEF-TOE") or source_name.startswith("DEF-ANKLE"):
        return "Foot.L" if source_name.endswith(".L") else "Foot.R"
    return None


def choose_target_bone(obj: bpy.types.Object) -> str:
    target_weights: dict[str, float] = {}
    vertex_groups = {group.index: group.name for group in obj.vertex_groups}

    for vertex in obj.data.vertices:
        for group in vertex.groups:
            source_bone_name = vertex_groups.get(group.group)
            if not source_bone_name:
                continue
            target_bone_name = map_source_bone_to_target(source_bone_name)
            if not target_bone_name:
                continue
            target_weights[target_bone_name] = target_weights.get(target_bone_name, 0.0) + group.weight

    if not target_weights:
        return "Torso"

    return max(target_weights.items(), key=lambda item: item[1])[0]


def duplicate_meshes(
    source_meshes: list[bpy.types.Object],
    runtime_armature: bpy.types.Object,
    collection: bpy.types.Collection,
) -> tuple[list[bpy.types.Object], dict[str, str]]:
    duplicated: list[bpy.types.Object] = []
    assignments: dict[str, str] = {}

    for source_obj in source_meshes:
        world_matrix = source_obj.matrix_world.copy()
        target_bone_name = choose_target_bone(source_obj)
        duplicate = source_obj.copy()
        duplicate.data = source_obj.data.copy()
        duplicate.name = f"{source_obj.name}_game"
        collection.objects.link(duplicate)

        for modifier in list(duplicate.modifiers):
            duplicate.modifiers.remove(modifier)

        duplicate.parent = runtime_armature
        duplicate.parent_type = "BONE"
        duplicate.parent_bone = target_bone_name
        duplicate.matrix_world = world_matrix
        duplicate.hide_set(False)
        duplicate.hide_render = False

        duplicated.append(duplicate)
        assignments[duplicate.name] = target_bone_name

    return duplicated, assignments


def add_sockets(runtime_armature: bpy.types.Object, collection: bpy.types.Collection) -> list[bpy.types.Object]:
    socket_objects: list[bpy.types.Object] = []
    for socket_name, parent_bone_name, local_offset in SOCKETS:
        socket = bpy.data.objects.new(socket_name, None)
        socket.empty_display_type = "PLAIN_AXES"
        socket.empty_display_size = 0.12
        socket.parent = runtime_armature
        socket.parent_type = "BONE"
        socket.parent_bone = parent_bone_name
        socket.matrix_parent_inverse.identity()
        socket.location = local_offset
        socket.rotation_euler = (0.0, 0.0, 0.0)
        socket.scale = (1.0, 1.0, 1.0)
        collection.objects.link(socket)
        socket_objects.append(socket)
    return socket_objects


def bake_runtime_actions(source_armature: bpy.types.Object, runtime_armature: bpy.types.Object) -> list[str]:
    source_armature.animation_data_create()
    runtime_armature.animation_data_create()

    pose_bones = runtime_armature.pose.bones
    bone_map = {
        "Pelvis": "DEF-HIPS",
        "Waist": "DEF-BODY",
        "Torso": "DEF-UPPER-BODY",
        "Head": "DEF-CAMERAS-BASE",
        "Arm.L": "DEF-ARM.L",
        "Gun.L": "DEF-CANON.L",
        "Arm.R": "DEF-ARM.R",
        "Gun.R": "DEF-CANON.R",
        "Thigh.L": "DEF-LEG.L",
        "Shin.L": "DEF-SHIN.L",
        "Foot.L": "DEF-FOOT-ALONG-Y.L",
        "Thigh.R": "DEF-LEG.R",
        "Shin.R": "DEF-SHIN.R",
        "Foot.R": "DEF-FOOT-ALONG-Y.R",
    }

    for pose_bone in pose_bones:
        pose_bone.rotation_mode = "QUATERNION"

    baked_actions: list[str] = []
    source_armature.hide_set(False)
    runtime_armature.hide_set(False)

    for source_name, target_name in ACTION_NAME_MAP.items():
        action = bpy.data.actions.get(source_name)
        if action is None:
            continue

        source_armature.animation_data.action = action
        runtime_armature.animation_data.action = None

        frame_start = int(action.frame_range[0])
        frame_end = int(action.frame_range[1])
        baked_action = bpy.data.actions.new(target_name)
        runtime_armature.animation_data.action = baked_action

        for frame in range(frame_start, frame_end + 1):
            bpy.context.scene.frame_set(frame)
            for target_bone_name, source_bone_name in bone_map.items():
                target_pose_bone = pose_bones[target_bone_name]
                source_pose_bone = source_armature.pose.bones[source_bone_name]
                target_pose_bone.matrix = source_pose_bone.matrix.copy()
                target_pose_bone.keyframe_insert(data_path="location", frame=frame)
                target_pose_bone.keyframe_insert(data_path="rotation_quaternion", frame=frame)
                target_pose_bone.keyframe_insert(data_path="scale", frame=frame)

            root_pose_bone = pose_bones["Root"]
            root_pose_bone.location = Vector((0.0, 0.0, 0.0))
            root_pose_bone.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
            root_pose_bone.scale = (1.0, 1.0, 1.0)
            root_pose_bone.keyframe_insert(data_path="location", frame=frame)
            root_pose_bone.keyframe_insert(data_path="rotation_quaternion", frame=frame)
            root_pose_bone.keyframe_insert(data_path="scale", frame=frame)

        baked_action.use_fake_user = True
        baked_actions.append(target_name)

    runtime_armature.animation_data.action = None
    source_armature.animation_data.action = None

    if "KWII_Idle" in baked_actions and "KWII_TorsoTurn" not in baked_actions:
        idle_action = bpy.data.actions.get("KWII_Idle")
        if idle_action is not None:
            torso_turn = idle_action.copy()
            torso_turn.name = "KWII_TorsoTurn"
            torso_turn.use_fake_user = True
            baked_actions.append("KWII_TorsoTurn")

    return baked_actions


def write_json(path: pathlib.Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def prune_actions(keep_names: list[str]) -> None:
    keep = set(keep_names)
    for action in list(bpy.data.actions):
        if action.name in keep:
            continue
        bpy.data.actions.remove(action)


def export_glb(
    output_path: pathlib.Path,
    runtime_armature: bpy.types.Object,
    mesh_objects: list[bpy.types.Object],
    socket_objects: list[bpy.types.Object],
) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    runtime_armature.select_set(True)
    for obj in mesh_objects:
        obj.select_set(True)
    for obj in socket_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = runtime_armature

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
        export_skins=False,
        export_lights=False,
        export_cameras=False,
    )


def save_blend_copy(path: pathlib.Path) -> None:
    bpy.ops.wm.save_as_mainfile(filepath=str(path), copy=True)


def main() -> None:
    argv = sys.argv
    args = argv[argv.index("--") + 1 :] if "--" in argv else []
    output_glb = resolve_output_path(args[0] if args else OUTPUT_GLB)
    output_blend = resolve_blend_path(output_glb, args[1] if len(args) > 1 else None)

    source_armature = get_source_armature()
    source_meshes = collect_source_meshes(source_armature)
    if not source_meshes:
        raise RuntimeError("No source *_low meshes were found")

    collection = ensure_collection(COLLECTION_NAME)
    runtime_armature = create_runtime_armature(source_armature, collection)
    duplicated_meshes, mesh_assignments = duplicate_meshes(source_meshes, runtime_armature, collection)
    socket_objects = add_sockets(runtime_armature, collection)
    baked_actions = bake_runtime_actions(source_armature, runtime_armature)

    materials_payload = {
        obj.name: [slot.material.name if slot.material else None for slot in obj.material_slots]
        for obj in duplicated_meshes
    }
    manifest_payload = {
        "armature": runtime_armature.name,
        "meshCount": len(duplicated_meshes),
        "socketNames": [obj.name for obj in socket_objects],
        "actions": baked_actions,
        "meshAssignments": mesh_assignments,
    }

    prune_actions(baked_actions)
    write_json(output_glb.with_suffix(".materials.json"), materials_payload)
    write_json(output_glb.with_suffix(".export.json"), manifest_payload)
    export_glb(output_glb, runtime_armature, duplicated_meshes, socket_objects)
    save_blend_copy(output_blend)

    print(
        "EXPORTED",
        {
            "glb": str(output_glb),
            "blend": str(output_blend),
            "meshCount": len(duplicated_meshes),
            "actions": baked_actions,
        },
    )


main()
