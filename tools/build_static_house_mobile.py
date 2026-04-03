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

REMOVED_NAME_PARTS = (
    '_Glass',
    '_Shutters'
)

REPLACED_OBJECTS = {
    'Front_Door',
    'Front_Door_Frame',
    'Chimney'
}

SIMPLE_MATERIALS = {
    'plaster': (0.73, 0.67, 0.58, 1.0),
    'wood': (0.49, 0.33, 0.22, 1.0),
    'roof': (0.72, 0.34, 0.22, 1.0),
    'stone': (0.57, 0.54, 0.50, 1.0),
    'brick': (0.54, 0.39, 0.33, 1.0),
    'window': (0.10, 0.13, 0.18, 1.0)
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--blend', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--root-name', default='StaticHouseMobile_A')
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


def get_material(name, rgba):
    material = bpy.data.materials.get(name)
    if material is None:
        material = bpy.data.materials.new(name=name)
    material.diffuse_color = rgba
    material.use_nodes = True
    principled = material.node_tree.nodes.get('Principled BSDF')
    if principled is not None:
        principled.inputs['Base Color'].default_value = rgba
        principled.inputs['Metallic'].default_value = 0.0
        principled.inputs['Roughness'].default_value = 0.95
        principled.inputs['Specular IOR Level'].default_value = 0.15
    return material


def choose_material_key(name):
    if name.startswith('LowpolyDoor'):
        return 'wood' if name == 'LowpolyDoor' else 'stone'
    if name.startswith('LowpolyChimney'):
        return 'brick'
    if name.startswith('LowpolyWindow'):
        return 'window'
    if name == 'Main_Roof':
        return 'roof'
    if name == 'Chimney':
        return 'brick'
    if name.startswith('Front_Door'):
        return 'wood' if name == 'Front_Door' else 'stone'
    if name.startswith('Corner_'):
        return 'wood'
    if name.startswith('Floor_'):
        return 'wood'
    if name.startswith('Gable_'):
        return 'plaster'
    if name.startswith('Wall_'):
        return 'plaster'
    return 'stone'


def iter_exportable_sources():
    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue
        if obj.name in EXCLUDED_OBJECTS:
            continue
        if obj.name in REPLACED_OBJECTS:
            continue
        if any(part in obj.name for part in REMOVED_NAME_PARTS):
            continue
        yield obj


def duplicate_sources(collection):
    duplicates = []
    for source in iter_exportable_sources():
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
        if obj.name.startswith('Floor_'):
            add_decimate(obj, 0.72)
        elif obj.name == 'Main_Roof':
            add_decimate(obj, 0.68)


def create_box(collection, name, location, size):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0] * 0.5, size[1] * 0.5, size[2] * 0.5)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if obj.users_collection:
        for owner in list(obj.users_collection):
            owner.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def create_lowpoly_replacements(collection):
    replacements = []

    replacements.append(create_box(collection, 'LowpolyDoorFrame_Left', (-0.74, -4.0, 1.2), (0.2, 0.22, 2.35)))
    replacements.append(create_box(collection, 'LowpolyDoorFrame_Right', (0.74, -4.0, 1.2), (0.2, 0.22, 2.35)))
    replacements.append(create_box(collection, 'LowpolyDoorFrame_Top', (0.0, -4.0, 2.33), (1.68, 0.22, 0.2)))
    replacements.append(create_box(collection, 'LowpolyDoor', (0.0, -3.94, 1.07), (1.18, 0.12, 2.08)))

    replacements.append(create_box(collection, 'LowpolyChimney', (1.45, 1.2, 7.95), (0.68, 0.68, 2.2)))

    window_specs = [
        ('LowpolyWindow_FrontLower_L', (-2.0, -4.05, 1.2), (0.95, 0.10, 1.25)),
        ('LowpolyWindow_FrontLower_R', (2.0, -4.05, 1.2), (0.95, 0.10, 1.25)),
        ('LowpolyWindow_BackLower_C', (0.0, 4.05, 1.2), (1.05, 0.10, 1.20)),
        ('LowpolyWindow_LeftLower_A', (-3.05, -1.0, 1.2), (0.10, 0.95, 1.20)),
        ('LowpolyWindow_LeftLower_B', (-3.05, 1.0, 1.2), (0.10, 0.95, 1.20)),
        ('LowpolyWindow_RightLower_A', (3.05, -1.0, 1.2), (0.10, 0.95, 1.20)),
        ('LowpolyWindow_RightLower_B', (3.05, 1.0, 1.2), (0.10, 0.95, 1.20)),
        ('LowpolyWindow_FrontUpper_L', (-2.0, -4.05, 4.18), (0.95, 0.10, 1.25)),
        ('LowpolyWindow_FrontUpper_R', (2.0, -4.05, 4.18), (0.95, 0.10, 1.25)),
        ('LowpolyWindow_BackUpper_C', (0.0, 4.05, 4.18), (1.05, 0.10, 1.20)),
        ('LowpolyWindow_LeftUpper_A', (-3.05, -3.0, 4.18), (0.10, 0.95, 1.20)),
        ('LowpolyWindow_LeftUpper_B', (-3.05, 1.0, 4.18), (0.10, 0.95, 1.20)),
        ('LowpolyWindow_RightUpper_A', (3.05, -3.0, 4.18), (0.10, 0.95, 1.20)),
        ('LowpolyWindow_RightUpper_B', (3.05, 1.0, 4.18), (0.10, 0.95, 1.20))
    ]
    for name, location, size in window_specs:
        replacements.append(create_box(collection, name, location, size))

    return replacements


def assign_simple_materials(objects):
    material_cache = {key: get_material(f'SM_{key.title()}', rgba) for key, rgba in SIMPLE_MATERIALS.items()}
    for obj in objects:
        key = choose_material_key(obj.name)
        material = material_cache[key]
        obj.data.materials.clear()
        obj.data.materials.append(material)
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.shade_flat()


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


def center_on_ground(obj):
    min_v, max_v, _dims = compute_bounds([obj])
    center = (min_v + max_v) * 0.5
    translation = mathutils.Vector((-center.x, -center.y, -min_v.z))
    obj.location += translation
    bpy.context.view_layer.update()
    return compute_bounds([obj])


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
    bpy.ops.wm.open_mainfile(filepath=args.blend)

    collection = bpy.data.collections.new('StaticHouseMobileExport')
    bpy.context.scene.collection.children.link(collection)
    duplicates = duplicate_sources(collection)
    duplicates.extend(create_lowpoly_replacements(collection))
    if not duplicates:
        raise RuntimeError('No exportable source meshes found.')

    simplify_geometry(duplicates)
    assign_simple_materials(duplicates)
    joined = join_objects(duplicates, args.root_name)
    cleanup_mesh(joined)
    min_v, max_v, dims = center_on_ground(joined)
    tris = triangle_count(joined)

    print('OPTIMIZED_OBJECTS', len(duplicates))
    print('OPTIMIZED_TRIS', tris)
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
