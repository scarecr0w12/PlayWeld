export function blenderDiscoverScript(): string {
  return `import bpy, json, sys\nprint('GCDCC_JSON:' + json.dumps({\n  'tool': 'blender',\n  'version': bpy.app.version_string,\n  'python': sys.version.split()[0],\n  'addons': sorted([name for name, state in bpy.context.preferences.addons.items() if state]),\n}))`;
}

export function blenderInspectScript(outputPath: string): string {
  return `import bpy, json\nfrom mathutils import Vector\nobjects = []\nfor obj in bpy.data.objects:\n    bounds = [list(obj.matrix_world @ Vector(corner)) for corner in obj.bound_box] if obj.type == 'MESH' else []\n    objects.append({'name': obj.name, 'type': obj.type, 'materials': [slot.material.name for slot in obj.material_slots if slot.material], 'bounds': bounds, 'vertices': len(obj.data.vertices) if obj.type == 'MESH' else 0, 'faces': len(obj.data.polygons) if obj.type == 'MESH' else 0})\nreport = {'tool': 'blender', 'version': bpy.app.version_string, 'objects': objects, 'meshes': sum(1 for obj in objects if obj['type'] == 'MESH'), 'materials': len(bpy.data.materials), 'armatures': sum(1 for obj in bpy.data.objects if obj.type == 'ARMATURE'), 'animations': [action.name for action in bpy.data.actions], 'collections': [collection.name for collection in bpy.data.collections]}\nwith open(${JSON.stringify(outputPath)}, 'w', encoding='utf-8') as file: json.dump(report, file, indent=2)\nprint('GCDCC_JSON:' + json.dumps(report))`;
}

export function blenderImportScript(filePath: string, format: string, outputPath: string): string {
  const importOperation = blenderImportOperation(format, filePath);
  return `import bpy, json\nbpy.ops.wm.read_factory_settings(use_empty=True)\nbefore = set(obj.name for obj in bpy.data.objects)\n${importOperation}\ncreated = sorted(obj.name for obj in bpy.data.objects if obj.name not in before)\nbpy.ops.wm.save_as_mainfile(filepath=${JSON.stringify(outputPath)})\nprint('GCDCC_JSON:' + json.dumps({'imported': created}))`;
}

export function blenderExportScript(outputPath: string, format: string): string {
  const exportOperation = blenderExportOperation(format, outputPath);
  return `import bpy, json\n${exportOperation}\nprint('GCDCC_JSON:' + json.dumps({'output': ${JSON.stringify(outputPath)}, 'format': ${JSON.stringify(format)}}))`;
}

export function blenderValidateScript(outputPath: string): string {
  return `import bpy, json, os\nmissing = []\nfor image in bpy.data.images:\n    if image.source == 'FILE' and image.filepath:\n        resolved = bpy.path.abspath(image.filepath)\n        if not os.path.exists(resolved): missing.append({'image': image.name, 'path': resolved})\nnonManifold = []\nfor obj in bpy.data.objects:\n    if obj.type != 'MESH': continue\n    bm = None\n    try:\n        import bmesh\n        bm = bmesh.new(); bm.from_mesh(obj.data)\n        count = sum(1 for edge in bm.edges if not edge.is_manifold)\n        if count: nonManifold.append({'object': obj.name, 'edges': count})\n    finally:\n        if bm: bm.free()\nreport = {'tool': 'blender', 'version': bpy.app.version_string, 'missingTextures': missing, 'nonManifold': nonManifold}\nwith open(${JSON.stringify(outputPath)}, 'w', encoding='utf-8') as file: json.dump(report, file, indent=2)\nprint('GCDCC_JSON:' + json.dumps(report))`;
}

export function blenderRenderScript(outputPath: string, resolution: number, samples: number): string {
  return `import bpy, json, os
from mathutils import Vector
scene = bpy.context.scene
if not scene.camera:
    existing = next((obj for obj in scene.objects if obj.type == 'CAMERA'), None)
    if existing:
        scene.camera = existing
    else:
        points = [obj.matrix_world @ Vector(corner) for obj in scene.objects if obj.type == 'MESH' and not obj.hide_render for corner in obj.bound_box]
        if not points: raise RuntimeError('Preview requires a camera or a visible mesh to frame.')
        low = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
        high = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
        center = (low + high) * 0.5
        radius = max((high - low).length * 0.5, 0.1)
        camera = bpy.data.objects.new('_GameCrafterPreviewCamera', bpy.data.cameras.new('_GameCrafterPreviewCamera'))
        scene.collection.objects.link(camera)
        camera.location = center + Vector((1.6, -2.4, 1.5)) * radius
        camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera.data.type = 'ORTHO'
        camera.data.ortho_scale = radius * 2.8
        camera.data.clip_start = radius * 0.01
        camera.data.clip_end = radius * 100
        scene.camera = camera
        if not any(obj.type == 'LIGHT' for obj in scene.objects):
            light = bpy.data.objects.new('_GameCrafterPreviewLight', bpy.data.lights.new('_GameCrafterPreviewLight', 'AREA'))
            scene.collection.objects.link(light)
            light.location = center + Vector((1, -1, 2)) * radius * 3
            light.rotation_euler = (center - light.location).to_track_quat('-Z', 'Y').to_euler()
            light.data.energy = 250 * radius * radius
            light.data.shape = 'DISK'
            light.data.size = radius * 3
        if not scene.world:
            scene.world = bpy.data.worlds.new('_GameCrafterPreviewWorld')
            scene.world.color = (0.15, 0.15, 0.15)
render_engines = {item.identifier for item in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items}
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in render_engines else 'BLENDER_EEVEE'
scene.render.resolution_x = ${resolution}
scene.render.resolution_y = ${resolution}
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = ${JSON.stringify(outputPath)}
if hasattr(scene, 'eevee') and hasattr(scene.eevee, 'taa_render_samples'): scene.eevee.taa_render_samples = ${samples}
bpy.ops.render.render(write_still=True)
print('GCDCC_JSON:' + json.dumps({'output': scene.render.filepath, 'exists': os.path.exists(scene.render.filepath)}))`;
}

export function blenderRunScriptCommand(scriptPath: string): string[] {
  return ['--background', '--python', scriptPath];
}

export function blenderImportOperation(format: string, filePath: string): string {
  switch (format.toLowerCase()) {
    case 'glb':
    case 'gltf':
      return `bpy.ops.import_scene.gltf(filepath=${JSON.stringify(filePath)})`;
    case 'fbx':
      return `bpy.ops.import_scene.fbx(filepath=${JSON.stringify(filePath)})`;
    case 'obj':
      return `bpy.ops.wm.obj_import(filepath=${JSON.stringify(filePath)})`;
    case 'usd':
    case 'usdz':
      return `bpy.ops.wm.usd_import(filepath=${JSON.stringify(filePath)})`;
    default:
      throw new Error(`Blender import does not support ${format}.`);
  }
}

export function blenderExportOperation(format: string, outputPath: string): string {
  switch (format.toLowerCase()) {
    case 'glb':
      return `bpy.ops.export_scene.gltf(filepath=${JSON.stringify(outputPath)}, export_format='GLB')`;
    case 'gltf':
      return `bpy.ops.export_scene.gltf(filepath=${JSON.stringify(outputPath)}, export_format='GLTF_SEPARATE')`;
    case 'fbx':
      return `bpy.ops.export_scene.fbx(filepath=${JSON.stringify(outputPath)})`;
    case 'obj':
      return `bpy.ops.wm.obj_export(filepath=${JSON.stringify(outputPath)})`;
    case 'usd':
      return `bpy.ops.wm.usd_export(filepath=${JSON.stringify(outputPath)})`;
    default:
      throw new Error(`Blender export does not support ${format}.`);
  }
}
