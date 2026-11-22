"""Verify CUDA kernels, torchvision NMS, and a YOLOv8 backward pass offline."""
import torch
import torchvision
import ultralytics
from ultralytics import YOLO


def tensors(value):
    """Yield tensors from Ultralytics' version-dependent nested model output."""
    if isinstance(value, torch.Tensor):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from tensors(item)
    elif isinstance(value, (list, tuple)):
        for item in value:
            yield from tensors(item)


def main():
    print(f"PyTorch {torch.__version__}; torchvision {torchvision.__version__}; Ultralytics {ultralytics.__version__}")
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA unavailable: install CUDA 12.8 PyTorch and check the NVIDIA driver")
    print(f"GPU: {torch.cuda.get_device_name(0)}; CUDA: {torch.version.cuda}")
    boxes = torch.tensor([[0., 0., 10., 10.], [1., 1., 9., 9.]], device='cuda')
    torchvision.ops.nms(boxes, torch.tensor([0.9, 0.8], device='cuda'), 0.5)
    model = YOLO('yolov8n.yaml').model.cuda().train()
    predictions = model(torch.rand(2, 3, 64, 64, device='cuda'))
    outputs = list(tensors(predictions))
    if not outputs:
        raise RuntimeError('YOLOv8 produced no tensor outputs')
    sum(output.square().mean() for output in outputs).backward()
    torch.cuda.synchronize()
    print('PASS: CUDA NMS and YOLOv8 forward/backward work. Dataset training has not started.')


if __name__ == '__main__':
    main()
