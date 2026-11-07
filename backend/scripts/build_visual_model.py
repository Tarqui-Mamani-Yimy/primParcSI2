"""Document and reproduce the quantization of the CU40 visual model.

The checked-in runtime artifact is derived from the ONNX ResNet50 graph in
Qdrant/resnet50-onnx using ONNX Runtime dynamic quantization with QUInt8
weights. Its expected SHA-256 is
d6a93844f7662f604111766eb28292837701515cc9f92fd44b0968bcd3f69085.

This utility is not part of application startup and must not be run against
the checked-in artifact path. It writes only to a separately supplied output
path. The source graph and optional `onnx` package are needed only when
reproducing the model; inference uses the pinned `onnxruntime` runtime package.
"""

import argparse
from pathlib import Path


DEPLOYED_MODEL = Path(__file__).resolve().parents[1] / "app" / "ml_models" / "resnet50_int8.onnx"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Downloaded Qdrant/resnet50-onnx ONNX graph")
    parser.add_argument("output", type=Path, help="A new output path; never the deployed model path")
    args = parser.parse_args()
    if args.output.resolve() == DEPLOYED_MODEL.resolve():
        parser.error("refusing to overwrite the deployed CU40 model")
    if not args.source.is_file():
        parser.error(f"source ONNX graph does not exist: {args.source}")

    try:
        from onnxruntime.quantization import QuantType, quantize_dynamic
    except ImportError as exc:
        raise SystemExit("Install the optional `onnx` package to reproduce model quantization") from exc

    quantize_dynamic(
        model_input=str(args.source),
        model_output=str(args.output),
        weight_type=QuantType.QUInt8,
    )


if __name__ == "__main__":
    main()
