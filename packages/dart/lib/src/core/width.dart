/// Columns a character occupies, rather than the number of characters there
/// are.
library;

/// Code point ranges a monospace font draws twice as wide.
///
/// Korean, Japanese and Chinese translations are the normal case here, and
/// counting their characters as one column each is what pulls a report's
/// columns out of line and makes a length comparison against an English
/// original meaningless.
const List<List<int>> _wideRanges = [
  [0x1100, 0x115f],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xa960, 0xa97f],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f300, 0x1f64f],
  [0x1f900, 0x1f9ff],
  [0x20000, 0x3fffd],
];

/// Marks drawn on top of the character before them, taking no column of their
/// own.
const List<List<int>> _zeroWidthRanges = [
  [0x0300, 0x036f],
  [0x200b, 0x200f],
  [0xfe00, 0xfe0f],
  [0xfeff, 0xfeff],
];

bool _within(List<List<int>> ranges, int code) {
  for (final range in ranges) {
    if (code >= range[0] && code <= range[1]) {
      return true;
    }
  }

  return false;
}

/// Columns one character occupies: none, one, or two.
int charWidth(String char) {
  final code = char.runes.isEmpty ? 0 : char.runes.first;

  if (_within(_zeroWidthRanges, code)) {
    return 0;
  }

  return _within(_wideRanges, code) ? 2 : 1;
}

/// Columns a string occupies, rather than the number of characters in it.
int displayWidth(String text) {
  var width = 0;

  for (final rune in text.runes) {
    if (_within(_zeroWidthRanges, rune)) {
      continue;
    }

    width += _within(_wideRanges, rune) ? 2 : 1;
  }

  return width;
}
