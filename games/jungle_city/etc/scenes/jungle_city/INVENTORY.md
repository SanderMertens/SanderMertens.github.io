# Box primitive inventory

Inspected before scene design: `include/box/geometry.h`, `material.h`, `texture.h`, `camera.h`, `light.h`, `effects.h`, `atmosphere.h`, `render.h`, and `particle.h`, plus existing Santorini scene assets.

| Area | Available primitives |
| --- | --- |
| Basic geometry | Box, RoundedBox, Quad, Triangle, RightTriangle, TrianglePrism, RightTrianglePrism, NGon, Star |
| Curved solids | Sphere, HemiSphere, IcoSphere, Cone, Cylinder, Capsule, Torus, Tube (including partial arcs), Frustum |
| Authored and parametric geometry | Mesh3 with vertex colors; line/Bezier Path2D and Path3D; Profile2D with holes; ProfileExtrusion; Sweep; Loft; Lathe; EllipsoidShell; TorusShell; BeveledPrism |
| Surface detail | SurfaceAttachment positions details by surface coordinates; SurfaceMaterials separates outer, inner, rim and cap materials |
| Transforms and reuse | Position, Rotation (radians), Scale, parent hierarchies, prefabs and script templates; cached primitive meshes |
| Materials | Rgb, hierarchical Tint and Opacity, metallic/roughness PbrMaterial, ClearCoat, Emissive, refractive Transmission, AlphaCutoff, blend modes, back-face modes, NoShadow |
| Textures | TexturePath; PbrTextures albedo, normal, emissive and packed ORM; TextureTransform and wrapping |
| Lighting | Directional, point, spot and ambient lights; cookies; shadow atlas; indirect LightBake; ReflectionBake and local ReflectionProbe; image environments |
| Rendering | Scene/View/Surface, perspective and orthographic cameras, camera controllers, instanced meshes and culling, opaque/alpha-tested and sorted blended passes |
| Image effects | Gtao, Bloom, HeightFog, AutoExposure, Tonemap (PBR Neutral or Tony McMapface), Smaa |
| Sky and motion | Atmosphere and TimeOfDay; GPU particle emitters, curves, forces, collision, particle lights; transform/material transitions |

## Design decisions

Use rounded terraces and cylindrical cores for a recognizable future city, with timber ribs, horizontal balcony bands, hanging vines and planted roofs continuing the jungle's layered structure. A central canal leaves a sightline through dense districts. Skybridges connect every district along elevated pedestrian routes; a botanical conservatory marks the civic center. A finite earthen plinth makes the scene read as a diorama.

Use shared material prefabs and modest mesh subdivisions. Opaque teal glazing gives stable silhouettes and shadows at city scale. Reserve emissive accents for wayfinding. Use ambient fill, sunlight, GTAO, restrained fog, bloom, tonemapping and SMAA; avoid a costly whole-city probe bake by default. Vegetation and architecture are generated deterministically from grid coordinates and a seed. Assets are native Flecs geometry, requiring no downloaded models or textures.
