import 'package:chki18n/chki18n.dart';
import 'package:test/test.dart';

void main() {
  group('detectInterpolationDelimiters', () {
    test('reads each pair it knows', () {
      expect(
        detectInterpolationDelimiters('Hello {name}'),
        const Chki18nDelimiters(prefix: '{', suffix: '}'),
      );
      expect(
        detectInterpolationDelimiters('Hello [[name]]'),
        const Chki18nDelimiters(prefix: '[[', suffix: ']]'),
      );
      expect(
        detectInterpolationDelimiters('Hello ((name))'),
        const Chki18nDelimiters(prefix: '((', suffix: '))'),
      );
      expect(
        detectInterpolationDelimiters('Hello <name>'),
        const Chki18nDelimiters(prefix: '<', suffix: '>'),
      );
    });

    test('reads a doubled pair as itself, not as its single form', () {
      expect(
        detectInterpolationDelimiters('Hello {{name}}'),
        const Chki18nDelimiters(prefix: '{{', suffix: '}}'),
      );
    });

    test('allows the spacing a style may put inside the delimiters', () {
      expect(
        detectInterpolationDelimiters('Hello {{ name }}'),
        const Chki18nDelimiters(prefix: '{{', suffix: '}}'),
      );
    });

    test('is not fooled by the punctuation of the JSON holding the text', () {
      expect(detectInterpolationDelimiters('{"desc":{"hello":"Hello"}}'), isNull);
      expect(detectInterpolationDelimiters('{\n\t"list": ["a", "b"]\n}'), isNull);
    });

    test('answers with the first pair it believes when a text mixes two', () {
      expect(
        detectInterpolationDelimiters('{{a}} and [[b]]'),
        const Chki18nDelimiters(prefix: '{{', suffix: '}}'),
      );
    });

    test('has nothing to say about a text with no placeholder', () {
      expect(detectInterpolationDelimiters('Hello there'), isNull);
      expect(detectInterpolationDelimiters(''), isNull);
    });

    test('answers with one of the pairs it publishes', () {
      expect(interpolationDelimiters, contains(detectInterpolationDelimiters('Hello {name}')));
    });
  });

  group('the delimiters a scan saw', () {
    test('reports what the files it read are written with', () async {
      final session = await loadTranslations(path: 'test/samples/locales-no-issue');

      expect(session.detectedInterpolation, const Chki18nDelimiters(prefix: '{', suffix: '}'));
      // A guess about the files, not the setting the checks ran with.
      expect(session.options.interpolationPrefix, '{');
    });

    test('says nothing about files that hold no placeholder', () async {
      final session = await loadTranslations(path: 'test/samples/excluded-files');

      expect(session.detectedInterpolation, isNull);
    });

    test('says nothing when there was no directory to read', () async {
      final session = await loadTranslations();

      expect(session.detectedInterpolation, isNull);
    });
  });
}
