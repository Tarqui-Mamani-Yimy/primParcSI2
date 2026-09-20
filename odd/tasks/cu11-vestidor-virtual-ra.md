# CU11 — Utilizar Vestidor Virtual (RA)

## Objective
Replace the fully-fake "Virtual Try-On" screen (static image + hardcoded
fake "94%" numbers, no camera at all) with a real, scoped camera-based AR
overlay: live camera feed + pose detection to anchor the garment image over
the user's torso.

## Problem / Why
Investigated `mobile/app` before starting: `pubspec.yaml` has zero
camera/AR/pose packages, no camera permission declared in
`AndroidManifest.xml` or `Info.plist`, and `try_on_screen.dart` is 100%
mocked (a `CachedNetworkImage` of the product + a spinner + a hardcoded
`value: 0.94` progress bar with no computation behind it). The whole mobile
app runs on local dummy data (`dummyProducts` etc.), not the real backend —
a pre-existing, documented gap (CLAUDE.md) that CU11 does NOT need to fix;
AR try-on works the same whether the product image source is mock or real.

## Scope decision (user confirmed via AskUserQuestion, after being told
full biomechanical/body-tracking AR is unrealistic for this project's scope)
"RA acotada con cámara real": `camera` package (live preview) +
`google_mlkit_pose_detection` (shoulder/torso landmarks, no native
Swift/Kotlin code needed) + a 2D overlay of the product image anchored/
scaled to the detected torso region. This is NOT photorealistic cloth
simulation — it's a real camera + real pose-anchored overlay, honestly
scoped. Catalog images are regular studio product photos (opaque
background, not transparent garment cutouts) — the overlay will look like
a semi-transparent scaled photo card following the torso, not draped
fabric; documented as a known visual limitation, not a bug.

## Hard constraint: no Flutter toolchain in this environment
`flutter`/`dart` are not installed here — every other feature this session
had `tsc --noEmit` or `pytest` to verify against; this one has NOTHING.
Code is written by careful reading + Dart language knowledge, not compiled
or run. **The user must run `flutter pub get && flutter analyze` and test
on a device/emulator themselves before trusting this is correct.**

## Tasks
- [x] **T1** — `camera: ^0.11.0`, `google_mlkit_pose_detection: ^0.13.0`
      added to `pubspec.yaml` (versions are best-estimate, NOT pub.dev-
      verified — run `flutter pub outdated`).
- [x] **T2** — Android `CAMERA` permission + `uses-feature` added (file had
      zero `<uses-permission>` tags before). `minSdk` already delegates to
      `flutter.minSdkVersion` (no hardcoded override found) — should already
      be sufficient, not changed.
- [x] **T3** — iOS `NSCameraUsageDescription` added to `Info.plist`.
- [x] **T4** — `mobile/app/lib/screens/ar_try_on_screen.dart` created.
      Spot-read by the orchestrator (not compiled): well-structured, handles
      permission-denied/error/no-pose states, disposes camera + pose
      detector properly. Two spots explicitly flagged as uncertain by the
      implementer (commented in the file itself): the `CameraImage` →
      `InputImage` conversion (`_cameraImageToInputImage`, most version-
      fragile part of this whole integration), and the `previewSize`
      landscape-axis-swap assumption in `_GarmentOverlay`.
- [x] **T5** — `try_on_screen.dart`: extracted the mirror-canvas block into
      a small `_MirrorCanvas` StatefulWidget with a toggle button (camera
      icon, top-right) switching between the old static preview and the new
      `ArTryOnScreen` — chosen over a full replace to keep the diff minimal
      (the rest of the screen is a `StatelessWidget` reading `AppState` via
      `Provider`) and to give the user a working fallback if the camera/pose
      flow misbehaves on their device.
- [ ] **T6** — User-side verification. **Cannot be done in this session —
      no Flutter toolchain here.** User must run `flutter pub get`,
      `flutter analyze` (check the two flagged spots first if it fails),
      and test on a real device or Android emulator with a working camera
      (pose detection needs an actual camera feed — the iOS Simulator has
      none).

## Acceptance criteria
- Real camera feed shown, real permission prompt on first use (not silently
  skipped).
- Product image overlay follows detected shoulder/torso position in
  real time (not a fixed static position).
- Graceful handling of permission-denied and no-pose-detected states — no
  crash, no frozen black screen.
- `flutter analyze` clean (verified by the user, not by this session).

## Progress
- 2026-09-19: User asked whether we had everything needed for CU11 before
  implementing. Investigated: found zero AR/camera infra, the existing
  "Vestidor Virtual" screen is 100% fake. Recommended a scoped camera+pose
  overlay instead of full biomechanical AR (unrealistic for this project).
  User confirmed that scope. Flutter toolchain unavailable in this
  environment — flagged as a real limitation before starting. Task file
  created.

## Next step
T1-T5 implementation (delegated), then hand off T6 verification to the
user explicitly — this is the first CU this session that cannot be
self-verified before declaring done.

## Update 2026-09-20 — primer build real, encontrado y arreglado un bug real
Usuario corrió `flutter run` de verdad. `google_mlkit_pose_detection: ^0.13.0`
compiló sin errores (solo un warning de "unchecked operations", no
bloqueante). `camera: ^0.11.0` SÍ rompió el build:

```
error: Cannot attach type annotations @org.jspecify.annotations.NonNull to
SurfaceRequest.mSurfaceRecreationCompleter: class file for
androidx.concurrent.futures.CallbackToFutureAdapter not found
Execution failed for task ':camera_android_camerax:compileDebugJavaWithJavac'.
```

Causa raíz (verificada con WebSearch/WebFetch contra pub.dev y
github.com/flutter/flutter/issues/177972, no adivinada): Gradle 9.x (el
proyecto usa AGP 9.1.0/Gradle 9.3.1) dejó de promover dependencias
transitivas automáticamente — `camera_android_camerax` necesitaba una
versión >= 0.7.4+6 (donde se agregó la dependencia explícita a
`androidx.concurrent:concurrent-futures`) para compilar bajo Gradle 9. El
pin `camera: ^0.11.0` resolvía a una versión más vieja de
`camera_android_camerax` sin ese fix.

**Fix aplicado**: `pubspec.yaml` — `camera: ^0.11.0` → `^0.12.1` (versión
real actual confirmada en pub.dev, depende de `camera_android_camerax ^0.7.4`
que sí resuelve al fix). Sin cambios de código Dart — las APIs de `camera`
usadas en `ar_try_on_screen.dart` (`CameraController`, `availableCameras()`,
`CameraLensDirection`, `CameraImage`, `ImageFormatGroup`, `CameraPreview`,
`CameraException`) son estables entre 0.11.x y 0.12.x.

**Siguiente paso del usuario**: `flutter pub get` (para bajar la versión
nueva) y `flutter run` de nuevo.
