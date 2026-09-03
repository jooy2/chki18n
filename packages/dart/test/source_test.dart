import 'dart:io';

import 'package:chki18n/src/version.dart';
import 'package:test/test.dart';

final RegExp _importPattern = RegExp("""(?:import|export)\\s+'([^']+)'""");

/// Every library reachable from [entry] by following its `package:chki18n`
/// imports, and every specifier outside the package that any of them names.
Set<String> _reachableFrom(String entry) {
  final seen = <String>{};
  final external = <String>{};
  final queue = <String>[entry];

  while (queue.isNotEmpty) {
    final file = queue.removeLast();

    if (!seen.add(file)) {
      continue;
    }

    final source = File(file).readAsStringSync();

    for (final match in _importPattern.allMatches(source)) {
      final specifier = match[1]!;

      if (specifier.startsWith('package:chki18n/')) {
        queue.add('lib/${specifier.substring('package:chki18n/'.length)}');
        continue;
      }

      external.add(specifier);
    }
  }

  return external;
}

void main() {
  group('package:chki18n/core.dart', () {
    test('reaches no `dart:io`, so it runs where the file system does not', () {
      for (final specifier in _reachableFrom('lib/core.dart')) {
        expect(specifier, isNot('dart:io'), reason: 'the core entry point imports `$specifier`');
      }
    });

    test('depends on nothing outside the SDK', () {
      for (final specifier in _reachableFrom('lib/chki18n.dart')) {
        expect(
          specifier,
          startsWith('dart:'),
          reason: 'the package imports `$specifier`, which is not part of the SDK',
        );
      }
    });
  });

  group('the source itself', () {
    test('holds no character a review cannot see', () {
      // A zero width space or a stray escape in a source file is invisible in an
      // editor, in a diff and in review. Every one this package needs is written
      // as a `\\u` escape instead, and this is what keeps it that way.
      const forbidden = {0x00, 0x1b, 0xa0, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0xfeff};

      for (final directory in ['lib', 'bin', 'test']) {
        for (final entity in Directory(directory).listSync(recursive: true)) {
          if (entity is! File || !entity.path.endsWith('.dart')) {
            continue;
          }

          for (final rune in entity.readAsStringSync().runes) {
            expect(
              forbidden.contains(rune) || (rune < 0x20 && rune != 0x0a && rune != 0x09),
              isFalse,
              reason:
                  '${entity.path} holds U+${rune.toRadixString(16).toUpperCase().padLeft(4, '0')}',
            );
          }
        }
      }
    });
  });

  group('the published version', () {
    test('is the one `pubspec.yaml` declares', () {
      final pubspec = File('pubspec.yaml').readAsStringSync();
      final declared = RegExp(r'^version:\s*(\S+)$', multiLine: true).firstMatch(pubspec);

      expect(declared?.group(1), packageVersion);
    });
  });
}
