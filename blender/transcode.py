"""
Transcode a video to a small, web-friendly H.264 MP4 (no audio) using
Blender's built-in FFmpeg, and also write a poster frame.

  Blender -b -P blender/transcode.py -- IN OUT.mp4 [width=720] [max_seconds=20] [start_seconds=0]
"""
import bpy
import sys
import os

argv = sys.argv[sys.argv.index("--") + 1:]
src, dst = argv[0], argv[1]
width = int(argv[2]) if len(argv) > 2 else 720
max_s = float(argv[3]) if len(argv) > 3 else 20
start_s = float(argv[4]) if len(argv) > 4 else 0

scene = bpy.context.scene
clip = bpy.data.movieclips.load(src)          # used only to probe size / fps
fps = clip.fps or 30
w0, h0 = clip.size
h = int(round(h0 * width / w0 / 2) * 2)
scene.render.resolution_x, scene.render.resolution_y = width, h
scene.render.resolution_percentage = 100
seq = scene.sequence_editor_create()
strip = seq.sequences.new_movie("clip", src, channel=1, frame_start=1, fit_method="FIT")
print(f"PROBE {os.path.basename(src)}: {w0}x{h0} @ {fps:.2f} fps, {strip.frame_final_duration} frames")

scene.render.fps = int(round(fps))
scene.render.fps_base = 1
first = 1 + int(start_s * fps)
scene.frame_start = first
scene.frame_end = min(strip.frame_final_end - 1, first + int(max_s * fps))

# poster frame (middle of the clip)
scene.frame_set((scene.frame_start + scene.frame_end) // 2)
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 82
scene.render.filepath = os.path.splitext(dst)[0] + "-poster.jpg"
bpy.ops.render.render(write_still=True)

# video
scene.render.image_settings.file_format = "FFMPEG"
ff = scene.render.ffmpeg
ff.format = "MPEG4"
ff.codec = "H264"
ff.constant_rate_factor = "MEDIUM"
ff.ffmpeg_preset = "GOOD"
ff.gopsize = int(fps)
ff.audio_codec = "NONE"
scene.render.filepath = dst
bpy.ops.render.render(animation=True)
print("WROTE", dst)
