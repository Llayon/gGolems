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
    'Front_Path_1',
    'Front_Path_2',
    'Vine_Left',
    'Vine_Right',
    'Crate'
}

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

SECTION_DEFS = [
    ('SEC_FOUNDATION', {'section_id': 'SEC_FOUNDATION', 'hp': 9999, 'destructible': False, 'section_type': 'foundation'}),
    ('SEC_FRONT_LEFT', {'section_id': 'SEC_FRONT_LEFT', 'hp': 120, 'destructible': True, 'section_type': 'wall'}),
    ('SEC_FRONT_CENTER', {'section_id': 'SEC_FRONT_CENTER', 'hp': 140, 'destructible': True, 'section_type': 'wall'}),
    ('SEC_FRONT_RIGHT', {'section_id': 'SEC_FRONT_RIGHT', 'hp': 120, 'destructible': True, 'section_type': 'wall'}),
    ('SEC_BACK_LEFT', {'section_id': 'SEC_BACK_LEFT', 'hp': 110, 'destructible': True, 'section_type': 'wall'}),
    ('SEC_BACK_CENTER', {'section_id': 'SEC_BACK_CENTER', 'hp': 110, 'destructible': True, 'section_type': 'wall'}),
    ('SEC_BACK_RIGHT', {'section_id': 'SEC_BACK_RIGHT', 'hp': 110, 'destructible': True, 'section_type': 'wall'}),
    ('SEC_LEFT_SIDE', {'section_id': 'SEC_LEFT_SIDE', 'hp': 130, 'destructible': True, 'section_type': 'wall'}),
    ('SEC_RIGHT_SIDE', {'section_id': 'SEC_RIGHT_SIDE', 'hp': 130, 'destructible': True, 'section_type': 'wall'}),
    ('SEC_ROOF', {'section_id': 'SEC_ROOF', 'hp': 180, 'destructible': True, 'section_type': 'roof'}),
    ('SEC_CHIMNEY', {'section_id': 'SEC_CHIMNEY', 'hp': 60, 'destructible': True, 'section_type': 'chimney'}),
]

FOUNDATION_OBJECTS = {
    'Floor_Lower_-2_-1', 'Floor_Lower_-2_-3', 'Floor_Lower_-2_1', 'Floor_Lower_-2_3',
    'Floor_Lower_0_-1', 'Floor_Lower_0_-3', 'Floor_Lower_0_1', 'Floor_Lower_0_3',
    'Floor_Lower_2_-1', 'Floor_Lower_2_-3', 'Floor_Lower_2_1', 'Floor_Lower_2_3',
    'Floor_Upper_-2_-1', 'Floor_Upper_-2_-3', 'Floor_Upper_-2_1', 'Floor_Upper_-2_3',
    'Floor_Upper_0_-1', 'Floor_Upper_0_-3', 'Floor_Upper_0_1', 'Floor_Upper_0_3',
    'Floor_Upper_2_-1', 'Floor_Upper_2_-3', 'Floor_Upper_2_1', 'Floor_Upper_2_3',
    'Corner_-3_-4_0.0', 'Corner_-3_-4_3.02', 'Corner_-3_4_0.0', 'Corner_-3_4_3.02',
    'Corner_3_-4_0.0', 'Corner_3_-4_3.02', 'Corner_3_4_0.0', 'Corner_3_4_3.02'
}

FRONT_LEFT_OBJECTS = {
    'Wall_lower_front_left', 'Wall_upper_front_left',
    'lower_front_left_Glass', 'upper_front_left_Glass', 'upper_front_left_Shutters'
}

FRONT_CENTER_OBJECTS = {
    'Wall_lower_front_center', 'Wall_upper_front_center',
    'Front_Door', 'Front_Door_Frame'
}

FRONT_RIGHT_OBJECTS = {
    'Wall_lower_front_right', 'Wall_upper_front_right',
    'lower_front_right_Glass', 'upper_front_right_Glass', 'upper_front_right_Shutters'
}

BACK_LEFT_OBJECTS = {'Wall_lower_back_left', 'Wall_upper_back_left'}
BACK_CENTER_OBJECTS = {
    'Wall_lower_back_center', 'Wall_upper_back_center',
    'lower_back_center_Glass', 'upper_back_center_Glass', 'upper_back_center_Shutters'
}
BACK_RIGHT_OBJECTS = {'Wall_lower_back_right', 'Wall_upper_back_right'}

LEFT_SIDE_OBJECTS = {
    'Wall_lower_left_1', 'Wall_lower_left_2', 'Wall_lower_left_3', 'Wall_lower_left_4',
    'Wall_upper_left_1', 'Wall_upper_left_2', 'Wall_upper_left_3', 'Wall_upper_left_4',
    'lower_left_2_Glass', 'lower_left_3_Glass', 'upper_left_1_Glass', 'upper_left_3_Glass'
}

RIGHT_SIDE_OBJECTS = {
    'Wall_lower_right_1', 'Wall_lower_right_2', 'Wall_lower_right_3', 'Wall_lower_right_4',
    'Wall_upper_right_1', 'Wall_upper_right_2', 'Wall_upper_right_3', 'Wall_upper_right_4',
    'lower_right_2_Glass', 'lower_right_3_Glass', 'upper_right_1_Glass', 'upper_right_3_Glass'
}

ROOF_OBJECTS = {
    'Main_Roof',
    'Gable_Back',
    'Gable_Front'
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--blend', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--root-name', default='VillagePrefab_House_A_ROOT')
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])


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
    if '_Glass' in name:
        return 'window'
    if '_Shutters' in name:
        return 'wood'
    if name == 'Main_Roof' or name.startswith('Gable_'):
        return 'roof'
    if name == 'Chimney':
        return 'brick'
    if name.startswith('Corner_'):
        return 'wood'
    if name.startswith('Floor_'):
        return 'wood'
    if name.startswith('Wall_lower_'):
        return 'stone'
    if name.startswith('Wall_'):
        return 'plaster'
    return 'wood'


def create_empty(collection, name, props=None, parent=None):
    obj = bpy.data.objects.new(name, None)
    collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    if props:
        for key, value in props.items():
            obj[key] = value
    return obj


def iter_exportable_sources():
    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue
        if obj.name in EXCLUDED_OBJECTS:
            continue
        if obj.name in REPLACED_OBJECTS:
            continue
        yield obj


def duplicate_sources(collection):
    duplicates = {}
    for source in iter_exportable_sources():
        duplicate = source.copy()
        duplicate.data = source.data.copy()
        duplicate.animation_data_clear()
        collection.objects.link(duplicate)
        duplicate.matrix_world = source.matrix_world.copy()
        duplicates[source.name] = duplicate
    return duplicates


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
    replacements = {}
    frame_left = create_box(collection, 'LowpolyDoorFrame_Left', (-0.74, -4.0, 1.2), (0.2, 0.22, 2.35))
    frame_right = create_box(collection, 'LowpolyDoorFrame_Right', (0.74, -4.0, 1.2), (0.2, 0.22, 2.35))
    frame_top = create_box(collection, 'LowpolyDoorFrame_Top', (0.0, -4.0, 2.33), (1.68, 0.22, 0.2))
    door = create_box(collection, 'LowpolyDoor', (0.0, -3.94, 1.07), (1.18, 0.12, 2.08))
    chimney = create_box(collection, 'LowpolyChimney', (1.45, 1.2, 7.95), (0.68, 0.68, 2.2))

    replacements['Front_Door_Frame'] = [frame_left, frame_right, frame_top]
    replacements['Front_Door'] = [door]
    replacements['Chimney'] = [chimney]
    return replacements


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
        if obj.name == 'Main_Roof':
            add_decimate(obj, 0.68)
        elif obj.name.startswith('Floor_'):
            add_decimate(obj, 0.72)


def assign_simple_materials(objects):
    material_cache = {key: get_material(f'BH_{key.title()}', rgba) for key, rgba in SIMPLE_MATERIALS.items()}
    for obj in objects:
        key = choose_material_key(obj.name)
        material = material_cache[key]
        obj.data.materials.clear()
        obj.data.materials.append(material)
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.shade_flat()


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


def triangle_count(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    count = 0
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        count += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()
    return count


def parent_object(obj, parent):
    obj.parent = parent


def resolve_section_for_object(name):
    if name in FOUNDATION_OBJECTS:
        return 'SEC_FOUNDATION'
    if name in FRONT_LEFT_OBJECTS:
        return 'SEC_FRONT_LEFT'
    if name in FRONT_CENTER_OBJECTS:
        return 'SEC_FRONT_CENTER'
    if name in FRONT_RIGHT_OBJECTS:
        return 'SEC_FRONT_RIGHT'
    if name in BACK_LEFT_OBJECTS:
        return 'SEC_BACK_LEFT'
    if name in BACK_CENTER_OBJECTS:
        return 'SEC_BACK_CENTER'
    if name in BACK_RIGHT_OBJECTS:
        return 'SEC_BACK_RIGHT'
    if name in LEFT_SIDE_OBJECTS:
        return 'SEC_LEFT_SIDE'
    if name in RIGHT_SIDE_OBJECTS:
        return 'SEC_RIGHT_SIDE'
    if name in ROOF_OBJECTS or name.startswith('HouseSeamPost_'):
        return 'SEC_ROOF'
    if name == 'Chimney' or name.startswith('LowpolyChimney'):
        return 'SEC_CHIMNEY'
    return 'SEC_FOUNDATION'


def center_root_on_ground(root, meshes):
    min_v, max_v, dims = compute_bounds(meshes)
    center = (min_v + max_v) * 0.5
    translation = mathutils.Vector((-center.x, -center.y, -min_v.z))
    root.location += translation
    bpy.context.view_layer.update()
    return compute_bounds(meshes)


def export_glb(root, output_path):
    export_dir = os.path.dirname(output_path)
    if export_dir:
        os.makedirs(export_dir, exist_ok=True)

    bpy.ops.object.select_all(action='DESELECT')
    objects_to_select = [root] + list(root.children_recursive)
    for obj in objects_to_select:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root

    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_tangents=False,
        export_materials='EXPORT',
        export_extras=True,
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

    collection = bpy.data.collections.new('BreakableHouseExport')
    bpy.context.scene.collection.children.link(collection)

    root = create_empty(
        collection,
        args.root_name,
        props={
            'prefab_id': 'village_house_a_breakable',
            'prefab_type': 'destructible_building',
            'web_profile': 'flat_materials_v1'
        }
    )
    section_roots = {
        name: create_empty(collection, name, props=props, parent=root)
        for name, props in SECTION_DEFS
    }

    duplicates = duplicate_sources(collection)
    replacements = create_lowpoly_replacements(collection)

    all_meshes = list(duplicates.values())
    for group in replacements.values():
        all_meshes.extend(group)

    simplify_geometry(all_meshes)
    assign_simple_materials(all_meshes)

    for source_name, duplicate in duplicates.items():
        section_name = resolve_section_for_object(source_name)
        parent_object(duplicate, section_roots[section_name])

    for section_name in ('SEC_FRONT_CENTER', 'SEC_CHIMNEY'):
        for replacement_key, objects in replacements.items():
            target_section = 'SEC_CHIMNEY' if replacement_key == 'Chimney' else 'SEC_FRONT_CENTER'
            if target_section != section_name:
                continue
            for obj in objects:
                parent_object(obj, section_roots[section_name])

    min_v, max_v, dims = center_root_on_ground(root, all_meshes)
    tris = triangle_count(all_meshes)

    print('SECTION_COUNT', len(section_roots))
    print('OPTIMIZED_OBJECTS', len(all_meshes))
    print('OPTIMIZED_TRIS', tris)
    print('BBOX_MIN', tuple(round(v, 3) for v in min_v))
    print('BBOX_MAX', tuple(round(v, 3) for v in max_v))
    print('DIMS', tuple(round(v, 3) for v in dims))

    export_glb(root, args.out)
    print('EXPORTED', args.out, os.path.getsize(args.out))


if __name__ == '__main__':
    main()
