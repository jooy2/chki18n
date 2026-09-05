import 'package:chki18n/chki18n.dart';
import 'package:test/test.dart';

const String samplePath = 'test/samples/excluded-files';

Future<Chki18nScanResult> scan([Chki18nOptions? options]) => scanTranslationDirectory(
  samplePath,
  resolveOptions((options ?? const Chki18nOptions()).copyWith(target: 'en')).options,
);

void main() {
  group('pathSegments', () {
    test('reads a path written either way', () {
      expect(pathSegments('src/legacy'), ['src', 'legacy']);
      expect(pathSegments(r'src\legacy'), ['src', 'legacy']);
    });

    test('drops what carries no meaning', () {
      expect(pathSegments('./src//legacy/'), ['src', 'legacy']);
      expect(pathSegments(''), <String>[]);
    });
  });

  group('matchesNamePattern', () {
    test('matches a name with no wildcard exactly', () {
      expect(matchesNamePattern('package.json', 'package.json'), isTrue);
      expect(matchesNamePattern('my-package.json', 'package.json'), isFalse);
    });

    test('lets `*` stand for any run of characters', () {
      expect(matchesNamePattern('pnpm-lock.json', '*-lock.json'), isTrue);
      expect(matchesNamePattern('tsconfig.build.json', 'tsconfig.*.json'), isTrue);
      expect(matchesNamePattern('tsconfig.json', 'tsconfig.*.json'), isFalse);
    });

    test('ignores case, the way the file systems these names come from do', () {
      expect(matchesNamePattern('Package.json', 'package.json'), isTrue);
    });

    test('does not let the ends of a pattern claim the same characters twice', () {
      expect(matchesNamePattern('ab', 'a*b'), isTrue);
      expect(matchesNamePattern('ab', 'a*b*b'), isFalse);
    });
  });

  group('createPathExcluder', () {
    test('reads one segment as a name at any depth', () {
      final excluded = createPathExcluder(['node_modules']);

      expect(excluded(['node_modules']), isTrue);
      expect(excluded(['src', 'node_modules']), isTrue);
      expect(excluded(['src']), isFalse);
    });

    test('reads two segments as a path from the root', () {
      final excluded = createPathExcluder(['src/legacy']);

      expect(excluded(['src', 'legacy']), isTrue);
      expect(excluded(['src', 'legacy', 'ui']), isTrue);
      expect(excluded(['legacy']), isFalse);
      expect(excluded(['app', 'src', 'legacy']), isFalse);
    });
  });

  group('createFileExcluder', () {
    test('answers for the default list', () {
      final excluded = createFileExcluder(defaultExcludeFiles);

      expect(excluded('package-lock.json'), isTrue);
      expect(excluded('tsconfig.base.json'), isTrue);
      expect(excluded('vite.config.json'), isTrue);
      expect(excluded('en.json'), isFalse);
      expect(excluded('common.json'), isFalse);
    });
  });

  group('excludeFiles', () {
    test('leaves a configuration file out of the scan entirely', () async {
      final result = await scan();

      expect(result.groups.keys.toList()..sort(), ['admin/common.json', 'common.json']);
      // Not merely skipped: an excluded file is never read, which is the point.
      expect(result.skipped, isEmpty);
      expect(result.issues, isEmpty);
    });

    test('reads what it was told to instead of the default list', () async {
      final result = await scan(
        const Chki18nOptions(text: Chki18nTextOptions(excludeFiles: 'nothing-matches-this')),
      );

      expect(result.files.map((file) => file.relativePath), contains('en/app.config.json'));
      expect(result.skipped, ['package-lock.json', 'tsconfig.json']);
    });

    test('is reported on the resolved options', () {
      final resolved = resolveOptions(
        const Chki18nOptions(text: Chki18nTextOptions(excludeFiles: '*.tmp.json, notes.json')),
      );

      expect(resolved.options.excludeFiles.toList(), ['*.tmp.json', 'notes.json']);
    });
  });

  group('exclude by path', () {
    Future<List<String>> filesOf(List<String> exclude) async {
      final result = await scan(Chki18nOptions(exclude: exclude));

      return [for (final file in result.files) file.relativePath];
    }

    test('skips one directory named by its path', () async {
      expect(await filesOf(['admin/ko']), [
        'admin/en/common.json',
        'en/common.json',
        'ko/common.json',
      ]);
    });

    test('still skips a bare name wherever it appears', () async {
      expect(await filesOf(['ko']), ['admin/en/common.json', 'en/common.json']);
    });

    test('applies to the source scan as well', () async {
      // A key nothing holds, so the walk cannot stop early and the count is the
      // number of files the excludes actually left it.
      Future<int> readOf(List<String> exclude) async {
        final usage = await findUnusedKeys(samplePath, [
          'nothing.at.all',
        ], resolveOptions(Chki18nOptions(target: 'en', exclude: exclude)).options);

        return usage.scannedFileCount;
      }

      // Four translation files; the lock file, the `tsconfig.json` and the
      // `app.config.json` are excluded by name.
      expect(await readOf(['node_modules']), 4);
      expect(await readOf(['node_modules', 'admin/ko']), 3);
      expect(await readOf(['node_modules', 'ko']), 2);
    });
  });
}
