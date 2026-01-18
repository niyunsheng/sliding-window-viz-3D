"""
Sliding Window 3D Visualization Utilities

This module provides utilities for computing 3D sliding window attention masks
commonly used in transformer models and convolutional neural networks.
"""

from typing import Tuple, List


def position_1d_to_3d(position_1d: int, volume_shape: Tuple[int, int, int]) -> Tuple[int, int, int]:
    """
    Convert a 1D position index to 3D coordinates (depth, height, width).

    Args:
        position_1d: The 1D position index (flattened)
        volume_shape: Tuple of (depth, height, width)

    Returns:
        Tuple of (depth_idx, height_idx, width_idx)

    Example:
        >>> position_1d_to_3d(5, (2, 3, 4))
        (0, 1, 1)
    """
    depth, height, width = volume_shape
    width_idx = position_1d % width
    height_idx = (position_1d // width) % height
    depth_idx = position_1d // (width * height)
    return (depth_idx, height_idx, width_idx)

def position_3d_to_1d(position_3d: Tuple[int, int, int], volume_shape: Tuple[int, int, int]) -> int:
    """
    Convert 3D coordinates (depth, height, width) to a 1D position index.

    Args:
        position_3d: Tuple of (depth_idx, height_idx, width_idx)
        volume_shape: Tuple of (depth, height, width)

    Returns:
        The flattened 1D position index

    Example:
        >>> position_3d_to_1d((0, 1, 1), (2, 3, 4))
        5
    """
    depth, height, width = volume_shape
    depth_idx, height_idx, width_idx = position_3d
    return depth_idx * (height * width) + height_idx * width + width_idx

def get_windows_3d(
    position_3d: Tuple[int, int, int],
    volume_shape: Tuple[int, int, int],
    window_size: Tuple[int, int, int],
    causal: Tuple[bool, bool, bool]
) -> List[Tuple[int, int, int]]:
    """
    Get all 3D positions within a sliding window centered at the given position.

    Args:
        position_3d: The center position (depth_idx, height_idx, width_idx)
        volume_shape: The shape of the volume (depth, height, width)
        window_size: The window radius in each dimension (window_depth, window_height, window_width)
        causal: Tuple of (causal_depth, causal_height, causal_width).
                True means only attend to current and past positions in that dimension

    Returns:
        List of 3D positions (depth_idx, height_idx, width_idx) within the window

    Note:
        - In causal mode for a dimension, only positions up to and including the current position are included
        - Window extends from (pos - window_size) to (pos + window_size) in non-causal mode
        - Window extends from (pos - window_size) to pos in causal mode
    """
    depth_idx, height_idx, width_idx = position_3d
    window_depth, window_height, window_width = window_size
    causal_depth, causal_height, causal_width = causal

    depth_start = max(depth_idx - window_depth, 0)
    height_start = max(height_idx - window_height, 0)
    width_start = max(width_idx - window_width, 0)

    depth_end = depth_idx + 1 if causal_depth else min(depth_idx + 1 + window_depth, volume_shape[0])
    height_end = height_idx + 1 if causal_height else min(height_idx + 1 + window_height, volume_shape[1])
    width_end = width_idx + 1 if causal_width else min(width_idx + 1 + window_width, volume_shape[2])

    results = []
    for d_idx in range(depth_start, depth_end):
        for h_idx in range(height_start, height_end):
            for w_idx in range(width_start, width_end):
                results.append((d_idx, h_idx, w_idx))
    return results


def get_sliding_window_mask_3d(
    volume_shape: Tuple[int, int, int],
    window_size: Tuple[int, int, int],
    causal: Tuple[bool, bool, bool] = (False, False, False)
) -> List[List[int]]:
    """
    Generate a binary attention mask matrix for 3D sliding window attention.

    This function computes an attention mask where mask[i][j] = 1 if token j is
    visible to token i within the sliding window, and 0 otherwise.

    Args:
        volume_shape: Tuple of (depth, height, width) representing the 3D volume shape
        window_size: Tuple of (window_depth, window_height, window_width) representing
                     the window radius in each dimension
        causal: Tuple of (causal_depth, causal_height, causal_width).
                True means only attend to current and past positions in that dimension

    Returns:
        A 2D list (matrix) of shape (total_tokens, total_tokens) where:
        - mask[query_pos][key_pos] = 1 if key_pos is within the sliding window of query_pos
        - mask[query_pos][key_pos] = 0 otherwise

    Example:
        >>> mask = get_sliding_window_mask_3d((1, 1, 4), (0, 0, 1), (False, False, False))
        >>> # Each token can see itself and its immediate neighbors
        >>> mask[0]  # Token 0 sees tokens 0 and 1
        [1, 1, 0, 0]
        >>> mask[1]  # Token 1 sees tokens 0, 1, and 2
        [1, 1, 1, 0]
    """
    depth, height, width = volume_shape
    total_tokens = depth * height * width

    # Initialize mask matrix with zeros
    mask = [[0 for _ in range(total_tokens)] for _ in range(total_tokens)]

    # For each query position
    for position_1d in range(total_tokens):
        # Convert to 3D coordinates
        position_3d = position_1d_to_3d(position_1d, volume_shape)

        # Get all key positions within the sliding window
        window_positions_3d = get_windows_3d(position_3d, volume_shape, window_size, causal)

        # Mark visible positions in the mask
        for kv_position_3d in window_positions_3d:
            kv_position_1d = position_3d_to_1d(kv_position_3d, volume_shape)
            mask[position_1d][kv_position_1d] = 1

    return mask

if __name__ == "__main__":
    def print_mask(mask: List[List[int]], style: str = "visual") -> None:
        """Helper function to print masks in a readable format.

        Args:
            style: "visual" (default, uses # and .) or "numeric" (shows [1, 0, ...])
        """
        if style == "numeric":
            for row in mask:
                print(row)
        else:
            for row in mask:
                print(''.join('# ' if val == 1 else '. ' for val in row))
        print("\n")

    print("=" * 60)
    print("3D Sliding Window Attention Mask Examples")
    print("=" * 60)

    # ============================================================
    # 1D Sequence Example (like text tokens)
    # ============================================================
    print("\n1. 1D SEQUENCE (4 tokens)")
    print("-" * 60)
    volume_shape = (1, 1, 4)  # depth, height, width
    window_size = (0, 0, 1)   # window_depth, window_height, window_width

    print("\n1D Sliding Window Mask (Causal=False)")
    print("Each token can see itself + neighbors within window_size=1")
    mask = get_sliding_window_mask_3d(volume_shape, window_size, (False, False, False))
    print_mask(mask)

    print("1D Sliding Window Mask (Causal=True)")
    print("Each token can only see itself + past neighbors within window_size=1")
    mask = get_sliding_window_mask_3d(volume_shape, window_size, (False, False, True))
    print_mask(mask)

    # ============================================================
    # 2D Image Example (like image patches)
    # ============================================================
    print("\n2. 2D IMAGE (4x4 grid = 16 tokens)")
    print("-" * 60)
    volume_shape = (1, 4, 4)  # depth, height, width
    window_size = (0, 1, 1)   # window_depth, window_height, window_width

    print("\n2D Sliding Window Mask (Causal=False)")
    print("Each token can see neighbors in a 3x3 spatial window")
    mask = get_sliding_window_mask_3d(volume_shape, window_size, (False, False, False))
    print_mask(mask)

    print("2D Sliding Window Mask (Causal=True)")
    print("Each token can only see past neighbors in a 3x3 spatial window")
    mask = get_sliding_window_mask_3d(volume_shape, window_size, (False, True, True))
    print_mask(mask)

    # ============================================================
    # 3D Video Example (like video frames)
    # ============================================================
    print("\n3. 3D VIDEO (4x4x4 volume = 64 tokens)")
    print("-" * 60)
    volume_shape = (4, 4, 4)  # depth, height, width
    window_size = (1, 1, 1)   # window_depth, window_height, window_width

    print("\n3D Sliding Window Mask (Causal=False)")
    print("Each token can see neighbors in a 3x3x3 spatiotemporal window")
    mask = get_sliding_window_mask_3d(volume_shape, window_size, (False, False, False))
    print_mask(mask)

    print("3D Sliding Window Mask (Causal=True only in temporal/frame dimension)")
    print("Each token can only see past frames, but all spatial neighbors in current frame")
    mask = get_sliding_window_mask_3d(volume_shape, window_size, (True, False, False))
    print_mask(mask)

    # ============================================================
    # 3D Volume (fully causal)
    # ============================================================
    print("\n4. 3D VOLUME (4x4x4 volume = 64 tokens)")
    print("-" * 60)
    print("3D Sliding Window Mask (Causal=True in all three dimensions)")
    print("Each token can only see past neighbors in all dimensions")
    mask = get_sliding_window_mask_3d(volume_shape, window_size, (True, True, True))
    print_mask(mask)

    print("=" * 60)
    print("Note: mask[i][j] = 1 means token i can attend to token j")
    print("=" * 60)