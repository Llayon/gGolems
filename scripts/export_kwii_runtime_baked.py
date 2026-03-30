import bpy
import pathlib
import sys


SOCKET_NAMES = ("viewAnchor", "leftArmMount", "rightArmMount", "torsoMount")
RIG_NAME = "KWII_RuntimeRig_Baked"
MESH_NAME = "KWII_BakedHeroMesh"


def main():
    argv = sys.argv
    if "--" in argv:
        export_args = argv[argv.index("--") + 1 :]
    else:
        export_args = []

    output_arg = export_args[0] if export_args else "src/assets/mechs/KWII_runtime_baked.glb"
    output_path = pathlib.Path(output_arg)
    if not output_path.is_absolute():
        output_path = pathlib.Path(bpy.path.abspath("//")) / output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)

    baked_rig = bpy.data.objects.get(RIG_NAME)
    baked_mesh = bpy.data.objects.get(MESH_NAME)
    if baked_rig is None or baked_rig.type != "ARMATURE":
        raise RuntimeError(f"Missing armature: {RIG_NAME}")
    if baked_mesh is None or baked_mesh.type != "MESH":
        raise RuntimeError(f"Missing mesh: {MESH_NAME}")

    export_objects = [baked_rig, baked_mesh]
    created_socket_names = []

    for socket_name in SOCKET_NAMES:
        source_socket = bpy.data.objects.get(socket_name)
        if source_socket is None:
            raise RuntimeError(f"Missing socket helper: {socket_name}")

        source_socket.name = f"{socket_name}_ExportRig"

        baked_socket = source_socket.copy()
        baked_socket.data = None
        baked_socket.name = socket_name
        baked_socket.parent = baked_rig
        baked_socket.parent_type = "BONE"
        baked_socket.parent_bone = source_socket.parent_bone
        baked_socket.location = source_socket.location.copy()
        baked_socket.rotation_mode = source_socket.rotation_mode
        baked_socket.rotation_euler = source_socket.rotation_euler.copy()
        baked_socket.rotation_quaternion = source_socket.rotation_quaternion.copy()
        baked_socket.scale = source_socket.scale.copy()
        baked_socket.empty_display_type = source_socket.empty_display_type
        baked_socket.empty_display_size = source_socket.empty_display_size
        bpy.context.scene.collection.objects.link(baked_socket)
        export_objects.append(baked_socket)
        created_socket_names.append(baked_socket.name)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in export_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = baked_rig

    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="NONE",
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_nla_strips=True,
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

    print(
        "EXPORTED",
        {
            "output": str(output_path),
            "mesh": baked_mesh.name,
            "rig": baked_rig.name,
            "sockets": created_socket_names,
        },
    )


main()
