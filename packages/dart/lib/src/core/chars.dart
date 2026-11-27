/// Character tests the analysis asks of every value, written against code
/// units.
///
/// A regular expression costs a call into the Dart runtime every time it is
/// asked anything, which on a value of a few dozen characters is several times
/// the cost of walking the value. These are what the patterns they replace
/// match, character for character, so a report does not change.
library;

/// Whether [unit] is one of the characters `\s` matches in a regular
/// expression, which is the same set in Dart and JavaScript: the ASCII
/// whitespace, the line and paragraph separators, the Unicode spaces and the
/// byte order mark.
bool isSpaceUnit(int unit) {
  if (unit < 0x80) {
    return unit == 0x20 || (unit >= 0x09 && unit <= 0x0d);
  }

  return unit == 0xa0 ||
      unit == 0x1680 ||
      (unit >= 0x2000 && unit <= 0x200a) ||
      unit == 0x2028 ||
      unit == 0x2029 ||
      unit == 0x202f ||
      unit == 0x205f ||
      unit == 0x3000 ||
      unit == 0xfeff;
}

/// The code point at [index] of [text], reading a surrogate pair as the one
/// character it is. A lone surrogate is returned as itself, the way
/// JavaScript's `codePointAt` returns it.
int codePointAt(String text, int index) {
  final unit = text.codeUnitAt(index);

  if (unit >= 0xd800 && unit <= 0xdbff && index + 1 < text.length) {
    final next = text.codeUnitAt(index + 1);

    if (next >= 0xdc00 && next <= 0xdfff) {
      return 0x10000 + ((unit - 0xd800) << 10) + (next - 0xdc00);
    }
  }

  return unit;
}
