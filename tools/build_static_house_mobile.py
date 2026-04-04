import argparse
import os
import sys

import bpy
import mathutils


EXCLUDED_OBJECTS = {
    'Ground',
    'House_Camera',
    'Sun',
    'Front_Fill',
    'Crate',
    'Front_Path_1',
    'Front_Path_2',
    'Vine_Left',
    'Vine_Right'
}

ATLAS_SIZE = 512
ATLAS_FILENAME = 'VillageHouse_A_BaseColor_512.png'
NORMAL_ATLAS_FILENAME = 'VillageHouse_A_Normal_512.png'
BAKE_MARGIN = 8


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--blend', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--root-name', default='StaticHouseMobile_A')
    parser.add_argument('--atlas')
    parser.add_argument('--save-blend')
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])


def compute_bounds(objects):
    min_v = mathutils.Vector((1e9, 1e9, 1e9))
    max_v = mathutils.Vector((-1e9, -1e9, -1e9))
    for obj in objects:
        for corner in obj.bound_box:
            world = obj.matrix_world @ mathutils.Vector(corner)
            min_v.x = min(min_v.x, world.x)
            min_v.y = min(min_v.y, world.y)
            min_v.z = min(min_v.z, world.z)
            max_v.x = max(max_v.x, world.x)
            max_v.y = max(max_v.y, world.y)
            max_v.z = max(max_v.z, world.z)
    return min_v, max_v, max_v - min_v


def iter_source_objects():
    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue
        if obj.name in EXCLUDED_OBJECTS:
            continue
        yield obj


def duplicate_sources(collection, sources):
    duplicates = []
    for source in sources:
        duplicate = source.copy()
        duplicate.data = source.data.copy()
        duplicate.animation_data_clear()
        collection.objects.link(duplicate)
        duplicate.matrix_world = source.matrix_world.copy()
        duplicates.append(duplicate)
    return duplicates


def apply_modifier(obj, modifier):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def add_decimate(obj, ratio):
    modifier = obj.modifiers.new(name='DecimateCollapse', type='DECIMATE')
    modifier.decimate_type = 'COLLAPSE'
    modifier.ratio = ratio
    modifier.use_collapse_triangulate = True
    apply_modifier(obj, modifier)


def simplify_geometry(objects):
    for obj in objects:
        if obj.name.startswith('Main_Roof'):
            add_decimate(obj, 0.78)
        elif obj.name.startswith('Floor_'):
            add_decimate(obj, 0.72)
        elif obj.name.startswith('Front_Door_Frame'):
            add_decimate(obj, 0.55)
        elif obj.name.startswith('Front_Door'):
            add_decimate(obj, 0.7)
        elif obj.name.startswith('Chimney'):
            add_decimate(obj, 0.65)


def join_objects(objects, root_name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = root_name
    return joined


def cleanup_mesh(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0001)
    bpy.ops.mesh.dissolve_degenerate()
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')


def ensure_atlas_uv(obj):
    atlas_uv = obj.data.uv_layers.get('AtlasUV')
    if atlas_uv is None:
        atlas_uv = obj.data.uv_layers.new(name='AtlasUV')
    obj.data.uv_layers.active = atlas_uv
    for uv_layer in obj.data.uv_layers:
        uv_layer.active_render = uv_layer.name == atlas_uv.name
    return atlas_uv


def smart_unwrap(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15192, island_margin=0.03, area_weight=0.0, margin_method='SCALED')
    bpy.ops.object.mode_set(mode='OBJECT')


def create_bake_image(name, filepath, colorspace='sRGB'):
    image = bpy.data.images.new(name, width=ATLAS_SIZE, height=ATLAS_SIZE, alpha=False)
    image.generated_color = (0.5, 0.5, 0.5, 1.0)
    image.filepath_raw = filepath
    image.file_format = 'PNG'
    image.colorspace_settings.name = colorspace
    return image


def create_baked_material(base_image, normal_image):
    material = bpy.data.materials.get('M_VillageHouse_A_Baked')
    if material is None:
        material = bpy.data.materials.new(name='M_VillageHouse_A_Baked')
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    color_tex_node = nodes.new(type='ShaderNodeTexImage')
    color_tex_node.name = 'BakeBaseColor'
    color_tex_node.image = base_image
    color_tex_node.interpolation = 'Linear'

    normal_tex_node = nodes.new(type='ShaderNodeTexImage')
    normal_tex_node.name = 'BakeNormal'
    normal_tex_node.image = normal_image
    normal_tex_node.interpolation = 'Linear'
    normal_tex_node.image.colorspace_settings.name = 'Non-Color'

    normal_map = nodes.new(type='ShaderNodeNormalMap')
    normal_map.inputs['Strength'].default_value = 0.9

    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.9
    bsdf.inputs['Metallic'].default_value = 0.0

    output = nodes.new(type='ShaderNodeOutputMaterial')
    links.new(color_tex_node.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(normal_tex_node.outputs['Color'], normal_map.inputs['Color'])
    links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    return material


def assign_baked_material(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)


def bake_diffuse_color(low_obj, high_sources, image):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 1
    scene.render.bake.margin = BAKE_MARGIN
    scene.render.bake.use_selected_to_active = True
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.use_pass_color = True

    bpy.ops.object.select_all(action='DESELECT')
    for obj in high_sources:
        obj.select_set(True)
    low_obj.select_set(True)
    bpy.context.view_layer.objects.active = low_obj
    image.generated_color = (0.0, 0.0, 0.0, 1.0)
    image.update()
    bpy.ops.object.bake(type='DIFFUSE', use_selected_to_active=True, cage_extrusion=0.04)
    image.save()
    image.pack()


def set_active_bake_node(material, node_name):
    nodes = material.node_tree.nodes
    node = nodes.get(node_name)
    if node is None:
        raise RuntimeError(f'Bake node "{node_name}" not found.')
    nodes.active = node
    return node


def bake_normal_map(low_obj, high_sources, image):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 1
    scene.render.bake.margin = BAKE_MARGIN
    scene.render.bake.use_selected_to_active = True

    bpy.ops.object.select_all(action='DESELECT')
    for obj in high_sources:
        obj.select_set(True)
    low_obj.select_set(True)
    bpy.context.view_layer.objects.active = low_obj
    image.generated_color = (0.5, 0.5, 1.0, 1.0)
    image.update()
    bpy.ops.object.bake(type='NORMAL', use_selected_to_active=True, cage_extrusion=0.04, normal_space='TANGENT')
    image.save()
    image.pack()


def center_on_ground(obj):
    min_v, max_v, _dims = compute_bounds([obj])
    center = (min_v + max_v) * 0.5
    translation = mathutils.Vector((-center.x, -center.y, -min_v.z))
    obj.location += translation
    bpy.context.view_layer.update()
    return compute_bounds([obj])


def apply_object_transforms(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def triangle_count(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    count = len(mesh.loop_triangles)
    evaluated.to_mesh_clear()
    return count


def export_glb(obj, output_path):
    export_dir = os.path.dirname(output_path)
    if export_dir:
        os.makedirs(export_dir, exist_ok=True)

    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_tangents=False,
        export_materials='EXPORT',
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=10,
        export_draco_generic_quantization=12
    )


def main():
    args = parse_args()
    atlas_path = args.atlas or os.path.join(os.path.dirname(args.out), ATLAS_FILENAME)
    normal_atlas_path = os.path.join(os.path.dirname(atlas_path), NORMAL_ATLAS_FILENAME)
    atlas_dir = os.path.dirname(atlas_path)
    if atlas_dir:
        os.makedirs(atlas_dir, exist_ok=True)

    bpy.ops.wm.open_mainfile(filepath=args.blend)

    source_objects = list(iter_source_objects())
    if not source_objects:
        raise RuntimeError('No exportable source meshes found.')

    collection = bpy.data.collections.new('StaticHouseMobileExport')
    bpy.context.scene.collection.children.link(collection)
    duplicates = duplicate_sources(collection, source_objects)
    simplify_geometry(duplicates)

    joined = join_objects(duplicates, args.root_name)
    cleanup_mesh(joined)
    ensure_atlas_uv(joined)
    smart_unwrap(joined)

    bake_image = create_bake_image('VillageHouse_A_BaseColor_512', atlas_path, 'sRGB')
    normal_image = create_bake_image('VillageHouse_A_Normal_512', normal_atlas_path, 'Non-Color')
    baked_material = create_baked_material(bake_image, normal_image)
    assign_baked_material(joined, baked_material)
    set_active_bake_node(baked_material, 'BakeBaseColor')
    bake_diffuse_color(joined, source_objects, bake_image)
    set_active_bake_node(baked_material, 'BakeNormal')
    bake_normal_map(joined, source_objects, normal_image)

    min_v, max_v, dims = center_on_ground(joined)
    apply_object_transforms(joined)
    min_v, max_v, dims = compute_bounds([joined])
    tris = triangle_count(joined)

    print('OPTIMIZED_OBJECTS', len(duplicates))
    print('OPTIMIZED_TRIS', tris)
    print('ATLAS', atlas_path, os.path.getsize(atlas_path))
    print('NORMAL_ATLAS', normal_atlas_path, os.path.getsize(normal_atlas_path))
    print('BBOX_MIN', tuple(round(v, 3) for v in min_v))
    print('BBOX_MAX', tuple(round(v, 3) for v in max_v))
    print('DIMS', tuple(round(v, 3) for v in dims))

    export_glb(joined, args.out)
    print('EXPORTED', args.out, os.path.getsize(args.out))

    if args.save_blend:
        save_dir = os.path.dirname(args.save_blend)
        if save_dir:
            os.makedirs(save_dir, exist_ok=True)
        try:
            bpy.ops.wm.save_as_mainfile(filepath=args.save_blend)
            print('SAVED_BLEND', args.save_blend, os.path.getsize(args.save_blend))
        except RuntimeError as error:
            print('SAVE_BLEND_WARNING', str(error))


if __name__ == '__main__':
    main()
