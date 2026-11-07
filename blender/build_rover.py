"""
Procedurally builds a stylized LiDAR rover for the portfolio hero section
and exports it as GLB (for Three.js) plus a PNG still render.

Run headless (from the project root):
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/build_rover.py

Edit dimensions/colours below, re-run, and the site picks up the new model.
"""
import bpy
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLB_OUT = os.path.join(ROOT, "assets", "models", "rover.glb")
PNG_OUT = os.path.join(ROOT, "assets", "img", "rover-render.png")

# ---------- reset scene ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def mat(name, color, metallic=0.0, rough=0.5, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    return m


BODY = mat("Body", (0.06, 0.07, 0.09), metallic=0.6, rough=0.35)
PANEL = mat("Panel", (0.85, 0.87, 0.9), metallic=0.1, rough=0.4)
TYRE = mat("Tyre", (0.02, 0.02, 0.02), rough=0.9)
HUB = mat("Hub", (0.5, 0.52, 0.55), metallic=1.0, rough=0.25)
GLOW = mat("Glow", (0.0, 0.9, 1.0), emit=(0.0, 0.9, 1.0), strength=6.0)
ACCENT = mat("Accent", (1.0, 0.35, 0.1), emit=(1.0, 0.35, 0.1), strength=3.0)
LENS = mat("Lens", (0.01, 0.01, 0.02), metallic=0.9, rough=0.05)


def add(obj, material, name):
    obj.name = name
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return obj


def bevel(obj, width=0.04, segs=4):
    m = obj.modifiers.new("Bevel", "BEVEL")
    m.width = width
    m.segments = segs
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier="Bevel")


parts = []

# ---------- chassis ----------
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.55))
c = bpy.context.object
c.scale = (1.6, 1.0, 0.35)
bpy.ops.object.transform_apply(scale=True)
bevel(c, 0.08)
parts.append(add(c, BODY, "Chassis"))

# top deck panel
bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.1, 0, 0.75))
d = bpy.context.object
d.scale = (1.2, 0.85, 0.08)
bpy.ops.object.transform_apply(scale=True)
bevel(d, 0.03)
parts.append(add(d, PANEL, "Deck"))

# glowing side strips
for y in (-0.505, 0.505):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, y, 0.55))
    s = bpy.context.object
    s.scale = (1.3, 0.02, 0.04)
    bpy.ops.object.transform_apply(scale=True)
    parts.append(add(s, GLOW, f"Strip{'L' if y > 0 else 'R'}"))

# ---------- wheels ----------
for x in (-0.55, 0.55):
    for y in (-0.62, 0.62):
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.3, depth=0.22, vertices=48,
            location=(x, y, 0.3), rotation=(math.pi / 2, 0, 0))
        w = bpy.context.object
        bevel(w, 0.05, 3)
        parts.append(add(w, TYRE, f"Wheel_{x}_{y}"))
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.16, depth=0.24, vertices=6,
            location=(x, y, 0.3), rotation=(math.pi / 2, 0, 0))
        parts.append(add(bpy.context.object, HUB, f"Hub_{x}_{y}"))

# ---------- LiDAR mast + puck ----------
bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.25, location=(-0.2, 0, 0.9))
parts.append(add(bpy.context.object, HUB, "Mast"))
bpy.ops.mesh.primitive_cylinder_add(radius=0.24, depth=0.18, vertices=64, location=(-0.2, 0, 1.1))
p = bpy.context.object
bevel(p, 0.03)
parts.append(add(p, BODY, "LidarBase"))
bpy.ops.mesh.primitive_cylinder_add(radius=0.245, depth=0.05, vertices=64, location=(-0.2, 0, 1.12))
parts.append(add(bpy.context.object, GLOW, "LidarRing"))  # spun in Three.js
bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=0.06, vertices=64, location=(-0.2, 0, 1.22))
parts.append(add(bpy.context.object, PANEL, "LidarCap"))

# ---------- camera head (front) ----------
bpy.ops.mesh.primitive_cube_add(size=1, location=(0.68, 0, 0.92))
h = bpy.context.object
h.scale = (0.22, 0.55, 0.22)
bpy.ops.object.transform_apply(scale=True)
bevel(h, 0.05)
parts.append(add(h, PANEL, "CamHead"))
for y in (-0.15, 0.15):
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.07, depth=0.06, vertices=32,
        location=(0.8, y, 0.92), rotation=(0, math.pi / 2, 0))
    parts.append(add(bpy.context.object, LENS, f"Lens{y}"))
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.075, minor_radius=0.012,
        location=(0.83, y, 0.92), rotation=(0, math.pi / 2, 0))
    parts.append(add(bpy.context.object, GLOW, f"Eye{y}"))

# antenna with orange tip
bpy.ops.mesh.primitive_cylinder_add(radius=0.015, depth=0.5, location=(-0.65, 0.3, 1.0))
parts.append(add(bpy.context.object, HUB, "Antenna"))
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.045, location=(-0.65, 0.3, 1.27))
parts.append(add(bpy.context.object, ACCENT, "AntennaTip"))

# front bumper accent
bpy.ops.mesh.primitive_cube_add(size=1, location=(0.81, 0, 0.45))
b = bpy.context.object
b.scale = (0.04, 0.8, 0.06)
bpy.ops.object.transform_apply(scale=True)
parts.append(add(b, ACCENT, "Bumper"))

# ---------- export GLB (Y-up for Three.js) ----------
os.makedirs(os.path.dirname(GLB_OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=GLB_OUT, export_format="GLB", export_yup=True,
                          export_apply=True, export_lights=False)
print("Exported", GLB_OUT)

# ---------- still render (OG image / fallback) ----------
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.01, 0.012, 0.02, 1)

bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
floor = bpy.context.object
floor.data.materials.append(mat("Floor", (0.02, 0.025, 0.035), metallic=0.5, rough=0.25))

for loc, energy, col in [((4, -4, 5), 800, (1, 1, 1)), ((-4, 3, 3), 400, (0.2, 0.8, 1)),
                         ((2, 5, 2), 300, (1, 0.4, 0.2))]:
    bpy.ops.object.light_add(type="AREA", location=loc)
    L = bpy.context.object
    L.data.energy = energy
    L.data.color = col
    L.data.size = 3
    L.rotation_euler = (0, 0, 0)
    con = L.constraints.new("TRACK_TO")
    con.target = parts[0]

bpy.ops.object.empty_add(location=(0, 0, 0.75))
aim = bpy.context.object
bpy.ops.object.camera_add(location=(5.2, -4.4, 2.9))
cam = bpy.context.object
con = cam.constraints.new("TRACK_TO")
con.target = aim
cam.data.lens = 50
scene.camera = cam

scene.render.engine = "BLENDER_EEVEE"
scene.eevee.use_bloom = True
scene.eevee.bloom_intensity = 0.08
scene.render.resolution_x = 1200
scene.render.resolution_y = 630
scene.render.filepath = PNG_OUT
bpy.ops.render.render(write_still=True)
print("Rendered", PNG_OUT)
