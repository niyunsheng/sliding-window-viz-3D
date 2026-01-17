"""
Sliding Window 3D Visualization Utilities

This module provides utilities for computing 3D sliding window attention masks
commonly used in transformer models and convolutional neural networks.
"""

from typing import Tuple, List


def position_1d_to_3d(position_1d: int, volume_shape: Tuple[int, int, int]) -> Tuple[int, int, int]:
    """
    Convert a 1D position index to 3D coordinates (frame, height, width).

    Args:
        position_1d: The 1D position index (flattened)
        volume_shape: Tuple of (frames, height, width)

    Returns:
        Tuple of (frame_idx, height_idx, width_idx)

    Example:
        >>> position_1d_to_3d(5, (2, 3, 4))
        (0, 1, 1)
    """
    frame, height, width = volume_shape
    width_idx = position_1d % width
    height_idx = (position_1d // width) % height
    frame_idx = position_1d // (width * height)
    return (frame_idx, height_idx, width_idx)

def position_3d_to_1d(position_3d: Tuple[int, int, int], volume_shape: Tuple[int, int, int]) -> int:
    """
    Convert 3D coordinates (frame, height, width) to a 1D position index.

    Args:
        position_3d: Tuple of (frame_idx, height_idx, width_idx)
        volume_shape: Tuple of (frames, height, width)

    Returns:
        The flattened 1D position index

    Example:
        >>> position_3d_to_1d((0, 1, 1), (2, 3, 4))
        5
    """
    frames, height, width = volume_shape
    frame_idx, height_idx, width_idx = position_3d
    return frame_idx * (height * width) + height_idx * width + width_idx

def get_windows_3d(
    position_3d: Tuple[int, int, int],
    volume_shape: Tuple[int, int, int],
    window_size: Tuple[int, int, int],
    causal: bool = False
) -> List[Tuple[int, int, int]]:
    """
    Get all 3D positions within a sliding window centered at the given position.

    Args:
        position_3d: The center position (frame_idx, height_idx, width_idx)
        volume_shape: The shape of the volume (frames, height, width)
        window_size: The window radius in each dimension (window_frame, window_height, window_width)
        causal: If True, only include past positions (causal attention)

    Returns:
        List of 3D positions (frame_idx, height_idx, width_idx) within the window

    Note:
        - In causal mode, only positions up to and including the current position are included
        - Window extends from (pos - window_size) to (pos + window_size) in non-causal mode
        - Window extends from (pos - window_size) to pos in causal mode
    """
    frame_idx, height_idx, width_idx = position_3d
    window_frame, window_height, window_width = window_size

    # Calculate the start and end indices for each dimension
    frame_start = max(frame_idx - window_frame, 0)
    height_start = max(height_idx - window_height, 0)
    width_start = max(width_idx - window_width, 0)

    if causal:
        # Causal: only include current and past positions
        frame_end = frame_idx + 1
        height_end = height_idx + 1
        width_end = width_idx + 1
    else:
        # Non-causal: include future positions as well
        frame_end = min(frame_idx + 1 + window_frame, volume_shape[0])
        height_end = min(height_idx + 1 + window_height, volume_shape[1])
        width_end = min(width_idx + 1 + window_width, volume_shape[2])

    results = []
    for f_idx in range(frame_start, frame_end):
        for h_idx in range(height_start, height_end):
            for w_idx in range(width_start, width_end):
                results.append((f_idx, h_idx, w_idx))
    return results


def get_sliding_window_mask_3d(
    volume_shape: Tuple[int, int, int],
    window_size: Tuple[int, int, int],
    causal: bool = False
) -> List[List[int]]:
    """
    Generate a binary attention mask matrix for 3D sliding window attention.

    This function computes an attention mask where mask[i][j] = 1 if token j is
    visible to token i within the sliding window, and 0 otherwise.

    Args:
        volume_shape: Tuple of (frames, height, width) representing the 3D volume shape
        window_size: Tuple of (window_frame, window_height, window_width) representing
                     the window radius in each dimension
        causal: If True, generates causal attention mask (each token can only attend
                to past tokens within the window)

    Returns:
        A 2D list (matrix) of shape (total_tokens, total_tokens) where:
        - mask[query_pos][key_pos] = 1 if key_pos is within the sliding window of query_pos
        - mask[query_pos][key_pos] = 0 otherwise

    Example:
        >>> mask = get_sliding_window_mask_3d((1, 1, 4), (0, 0, 1), causal=False)
        >>> # Each token can see itself and its immediate neighbors
        >>> mask[0]  # Token 0 sees tokens 0 and 1
        [1, 1, 0, 0]
        >>> mask[1]  # Token 1 sees tokens 0, 1, and 2
        [1, 1, 1, 0]
    """
    frame, height, width = volume_shape
    total_tokens = frame * height * width

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
    def print_mask(mask: List[List[int]]) -> None:
        """Helper function to print masks in a readable format."""
        for row in mask:
            print(row)
        print("\n")

    print("=" * 60)
    print("3D Sliding Window Attention Mask Examples")
    print("=" * 60)

    # ============================================================
    # 1D Sequence Example (like text tokens)
    # ============================================================
    print("\n1. 1D SEQUENCE (4 tokens)")
    print("-" * 60)
    volume_shape = (1, 1, 4)  # frames, height, width
    window_size = (0, 0, 1)   # window_frame, window_height, window_width

    print("\n1D Sliding Window Mask (Causal=False)")
    print("Each token can see itself + neighbors within window_size=1")
    mask = get_sliding_window_mask_3d(volume_shape, window_size, causal=False)
    print_mask(mask)

    print("1D Sliding Window Mask (Causal=True)")
    print("Each token can only see itself + past neighbors within window_size=1")
    mask = get_sliding_window_mask_3d(volume_shape, window_size, causal=True)
    print_mask(mask)

    # ============================================================
    # 2D Image Example (like image patches)
    # ============================================================
    print("\n2. 2D IMAGE (4x4 grid = 16 tokens)")
    print("-" * 60)
    volume_shape = (1, 4, 4)  # frames, height, width
    window_size = (0, 1, 1)   # window_frame, window_height, window_width

    print("\n2D Sliding Window Mask (Causal=False)")
    print("Each token can see neighbors in a 3x3 spatial window")
    mask = get_sliding_window_mask_3d(volume_shape, window_size, causal=False)
    print_mask(mask)

    print("2D Sliding Window Mask (Causal=True)")
    print("Each token can only see past neighbors in a 3x3 spatial window")
    mask = get_sliding_window_mask_3d(volume_shape, window_size, causal=True)
    print_mask(mask)

    # ============================================================
    # 3D Video Example (like video frames)
    # ============================================================
    print("\n3. 3D VIDEO (4x4x4 volume = 64 tokens)")
    print("-" * 60)
    volume_shape = (4, 4, 4)  # frames, height, width
    window_size = (1, 1, 1)   # window_frame, window_height, window_width

    print("\n3D Sliding Window Mask (Causal=False)")
    print("Each token can see neighbors in a 3x3x3 spatiotemporal window")
    mask = get_sliding_window_mask_3d(volume_shape, window_size, causal=False)
    print_mask(mask)

    print("3D Sliding Window Mask (Causal=True)")
    print("Each token can only see past neighbors in a 3x3x3 spatiotemporal window")
    mask = get_sliding_window_mask_3d(volume_shape, window_size, causal=True)
    print_mask(mask)

    print("=" * 60)
    print("Note: mask[i][j] = 1 means token i can attend to token j")
    print("=" * 60)