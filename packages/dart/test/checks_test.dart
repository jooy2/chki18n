import 'package:chki18n/chki18n.dart';
import 'package:test/test.dart';

/// Written as escapes: a test file holding one of these is unreviewable.
const String zeroWidthSpace = '\u200b';

const String nonBreakingSpace = '\u00a0';

/// The same two words with one of those characters hidden inside them, written
/// out rather than interpolated so the escape stays next to what it breaks.
const String zeroWidthInside = '\uc900\u200b\ube44';

const String nonBreakingInside = '\uac00\u00a0\ub098';

/// Runs one check on one pair of locales, which is what most of these need.
List<Chki18nIssue> check(
  Chki18nCheckCode code,
  Map<String, TranslationMap> locales, {
  Chki18nKeyCase? keyCase,
  int? maxKeyDepth,
  double? lengthRatio,
}) => analyzeTranslations(
  Chki18nInput(locales: locales),
  options: Chki18nOptions(
    target: 'en',
    flattened: true,
    checks: [code],
    keyCase: keyCase,
    maxKeyDepth: maxKeyDepth,
    lengthRatio: lengthRatio,
  ),
).of(code);

/// Runs every check and keeps what was said about the target language, so the
/// ones that must stay quiet about it are given the chance to fire.
List<Chki18nIssue> checkAll(
  Map<String, TranslationMap> locales, {
  double? lengthRatio,
  List<Chki18nCheckCode>? ignoreChecks,
}) =>
    analyzeTranslations(
      Chki18nInput(locales: locales),
      options: Chki18nOptions(
        target: 'en',
        flattened: true,
        lengthRatio: lengthRatio,
        ignoreChecks: ignoreChecks,
      ),
    ).issues.where((issue) => issue.locale == 'en').toList();

void main() {
  group('NO_LOCALE', () {
    test('finds the language a group is missing entirely', () {
      final result = analyzeTranslations(
        const Chki18nInput(
          groups: {
            'common.json': {
              'en': {'title': 'Folder'},
              'ko': {'title': '폴더'},
              'ja': {'title': 'フォルダ'},
            },
            'errors.json': {
              'en': {'missing': 'Not found'},
              'ko': {'missing': '없음'},
            },
          },
        ),
        options: const Chki18nOptions(target: 'en', checks: [Chki18nCheckCode.noLocale]),
      );
      final issues = result.of(Chki18nCheckCode.noLocale);

      expect(issues.length, 1);
      expect(issues.first.locale, 'ja');
      expect(issues.first.group, 'errors.json');
      expect(issues.first.key, '');
      expect(result.success, isFalse);
    });

    test('says nothing when every group has every language', () {
      final result = analyzeTranslations(
        const Chki18nInput(
          groups: {
            'a': {
              'en': {'x': 'X'},
              'ko': {'x': 'ㄱ'},
            },
            'b': {
              'en': {'y': 'Y'},
              'ko': {'y': 'ㄴ'},
            },
          },
        ),
        options: const Chki18nOptions(target: 'en', checks: [Chki18nCheckCode.noLocale]),
      );

      expect(result.issues, isEmpty);
    });

    test('cannot fire on a single group, where every language is in it', () {
      expect(
        check(Chki18nCheckCode.noLocale, const {
          'en': {'a': 'A'},
          'ko': {'a': 'ㄱ'},
        }),
        isEmpty,
      );
    });
  });

  group('INTERPOLATION_COUNT', () {
    test('finds a placeholder used fewer times than the target language uses it', () {
      final issues = check(Chki18nCheckCode.interpolationCount, const {
        'en': {'a': '{name} invited {name}'},
        'ko': {'a': '{name}님이 초대했습니다'},
      });

      expect(issues.length, 1);
      expect(issues.first.interpolation, 'name');
      expect(issues.first.message, contains('1 time here and 2 times'));
    });

    test('finds one used more times as well', () {
      expect(
        check(Chki18nCheckCode.interpolationCount, const {
          'en': {'a': 'Hello {name}'},
          'ko': {'a': '{name}님 안녕하세요 {name}님'},
        }).length,
        1,
      );
    });

    test('leaves a placeholder that is simply absent to the other checks', () {
      expect(
        check(Chki18nCheckCode.interpolationCount, const {
          'en': {'a': 'Hello {name}'},
          'ko': {'a': '안녕하세요'},
        }),
        isEmpty,
      );
    });

    test('says nothing when the counts agree', () {
      expect(
        check(Chki18nCheckCode.interpolationCount, const {
          'en': {'a': '{a} and {a} and {b}'},
          'ko': {'a': '{b}, {a}, {a}'},
        }),
        isEmpty,
      );
    });
  });

  group('TAG_MISMATCH', () {
    test('reports every missing tag as one finding', () {
      final issues = check(Chki18nCheckCode.tagMismatch, const {
        'en': {'a': 'Click <b>here</b> to continue'},
        'ko': {'a': '계속하려면 여기를 누르세요'},
      });

      expect(issues.length, 1);
      expect(issues.first.message, contains('`<b>` and `</b>`'));
    });

    test('reports a tag the target language does not have', () {
      final issues = check(Chki18nCheckCode.tagMismatch, const {
        'en': {'a': 'Plain text'},
        'ko': {'a': '<i>기울임</i>'},
      });

      expect(issues.length, 1);
      expect(issues.first.message, contains('not in the target language'));
    });

    test('counts the tags rather than only looking for them', () {
      final issues = check(Chki18nCheckCode.tagMismatch, const {
        'en': {'a': '<b>one</b> and <b>two</b>'},
        'ko': {'a': '<b>하나</b>와 둘'},
      });

      expect(issues.length, 1);
      expect(issues.first.message, contains('1 time of 2'));
    });

    test('reads a tag name whatever its case', () {
      expect(
        check(Chki18nCheckCode.tagMismatch, const {
          'en': {'a': '<B>Bold</B>'},
          'ko': {'a': '<b>굵게</b>'},
        }),
        isEmpty,
      );
    });

    test('does not mistake a comparison for markup', () {
      expect(
        check(Chki18nCheckCode.tagMismatch, const {
          'en': {'a': 'Use a < b to compare'},
          'ko': {'a': '비교하려면 a < b 를 쓰세요'},
        }),
        isEmpty,
      );
    });
  });

  group('UNTRANSLATED_SCRIPT', () {
    test('finds a Korean value written without a Korean character', () {
      final issues = check(Chki18nCheckCode.untranslatedScript, const {
        'en': {'a': 'Hello'},
        'ko': {'a': 'Hello!'},
      });

      expect(issues.length, 1);
      expect(issues.first.locale, 'ko');
    });

    test('leaves a value identical to the target to the untranslated check', () {
      expect(
        check(Chki18nCheckCode.untranslatedScript, const {
          'en': {'a': 'Hello'},
          'ko': {'a': 'Hello'},
        }),
        isEmpty,
      );
    });

    test('says nothing about a language written in the Latin alphabet', () {
      expect(
        check(Chki18nCheckCode.untranslatedScript, const {
          'en': {'a': 'Hello'},
          'fr': {'a': 'Salut !'},
        }),
        isEmpty,
      );
    });

    test('says nothing about a locale that names the Latin script itself', () {
      expect(
        check(Chki18nCheckCode.untranslatedScript, const {
          'en': {'a': 'Hello'},
          'sr-Latn': {'a': 'Zdravo'},
        }),
        isEmpty,
      );
    });

    test('leaves a value that is only a placeholder or a number alone', () {
      expect(
        check(Chki18nCheckCode.untranslatedScript, const {
          'en': {'a': '{count}', 'b': '2026'},
          'ko': {'a': '{count}', 'b': '2026'},
        }),
        isEmpty,
      );
    });
  });

  group('INCONSISTENT_VALUE', () {
    test('finds two keys with one original translated two ways', () {
      final issues = check(Chki18nCheckCode.inconsistentValue, const {
        'en': {'save-a': 'Save', 'save-b': 'Save'},
        'ko': {'save-a': '저장', 'save-b': '보관'},
      });

      expect(issues.length, 1);
      expect(issues.first.key, 'save-b');
      expect(issues.first.relatedKey, 'save-a');
      expect(issues.first.locale, 'ko');
    });

    test('says nothing when the two agree', () {
      expect(
        check(Chki18nCheckCode.inconsistentValue, const {
          'en': {'a': 'Save', 'b': 'Save'},
          'ko': {'a': '저장', 'b': '저장'},
        }),
        isEmpty,
      );
    });

    test('leaves a key the locale has not filled in to the other checks', () {
      expect(
        check(Chki18nCheckCode.inconsistentValue, const {
          'en': {'a': 'Save', 'b': 'Save'},
          'ko': {'a': '저장'},
        }),
        isEmpty,
      );
    });
  });

  group('INVISIBLE_CHARACTER', () {
    test('finds a zero width space and names it', () {
      final issues = check(Chki18nCheckCode.invisibleCharacter, const {
        'en': {'a': 'Ready'},
        'ko': {'a': zeroWidthInside},
      });

      expect(issues.length, 1);
      expect(issues.first.message, contains('zero width space'));
      expect(issues.first.message, contains('U+200B'));
    });

    test('finds a non-breaking space, which looks like an ordinary one', () {
      expect(
        check(Chki18nCheckCode.invisibleCharacter, const {
          'en': {'a': 'A B'},
          'ko': {'a': nonBreakingInside},
        }).length,
        1,
      );
    });

    test('says nothing about ordinary text', () {
      expect(
        check(Chki18nCheckCode.invisibleCharacter, const {
          'en': {'a': 'Ready'},
          'ko': {'a': '준비됨'},
        }),
        isEmpty,
      );
    });
  });

  group('NUMBER_MISMATCH', () {
    test('finds a number the translation changed', () {
      final issues = check(Chki18nCheckCode.numberMismatch, const {
        'en': {'a': 'You have 3 items'},
        'ko': {'a': '5개 있습니다'},
      });

      expect(issues.length, 1);
      expect(issues.first.message, contains('uses 3'));
    });

    test('accepts numbers the translation reordered', () {
      expect(
        check(Chki18nCheckCode.numberMismatch, const {
          'en': {'a': '3 of 5'},
          'ko': {'a': '5 중 3'},
        }),
        isEmpty,
      );
    });

    test('leaves a translation with no digits at all to `MISSING_NUMBER`', () {
      expect(
        check(Chki18nCheckCode.numberMismatch, const {
          'en': {'a': 'You have 3 items'},
          'ko': {'a': '여러 개 있습니다'},
        }),
        isEmpty,
      );
    });

    test('tells a padded number from a bare one', () {
      expect(
        check(Chki18nCheckCode.numberMismatch, const {
          'en': {'a': 'Step 3'},
          'ko': {'a': '03 단계'},
        }).length,
        1,
      );
    });
  });

  group('SUSPICIOUS_LENGTH', () {
    const long = 'Please choose the folder you would like to upload';

    test('reports nothing until `lengthRatio` says what is too far', () {
      expect(
        check(Chki18nCheckCode.suspiciousLength, const {
          'en': {'a': long},
          'ko': {'a': '폴더'},
        }),
        isEmpty,
      );
    });

    test('finds a translation far shorter than its original', () {
      final issues = check(Chki18nCheckCode.suspiciousLength, const {
        'en': {'a': long},
        'ko': {'a': '폴더'},
      }, lengthRatio: 3);

      expect(issues.length, 1);
      expect(issues.first.level, Chki18nLevel.info);
    });

    test('finds one far longer as well', () {
      expect(
        check(Chki18nCheckCode.suspiciousLength, const {
          'en': {'a': 'Upload a file'},
          'ko': {'a': '파일을 하나 올리는 방법에 대한 아주 긴 설명입니다'},
        }, lengthRatio: 2).length,
        1,
      );
    });

    test('counts a wide character as two, so Korean is not short by default', () {
      expect(
        check(Chki18nCheckCode.suspiciousLength, const {
          'en': {'a': 'Shared folder'},
          'ko': {'a': '공유 폴더'},
        }, lengthRatio: 2),
        isEmpty,
      );
    });

    test('leaves a short original alone, where a ratio says nothing', () {
      expect(
        check(Chki18nCheckCode.suspiciousLength, const {
          'en': {'a': 'OK'},
          'ko': {'a': '확인했습니다'},
        }, lengthRatio: 2),
        isEmpty,
      );
    });
  });

  group('NO_PLURAL_FORM', () {
    const forms = <String, TranslationMap>{
      'en': {'item_one': '1 item', 'item_other': '{count} items'},
    };

    test('asks a language only for the forms it uses', () {
      expect(
        check(Chki18nCheckCode.noPluralForm, {
          ...forms,
          'ko': const {'item_other': '{count}개'},
        }),
        isEmpty,
      );
    });

    test('finds the forms a language needs and does not have', () {
      final issues = check(Chki18nCheckCode.noPluralForm, {
        ...forms,
        'ru': const {'item_one': '1 элемент', 'item_other': '{count} элементов'},
      });

      expect(issues.length, 1);
      expect(issues.first.locale, 'ru');
      expect(issues.first.key, 'item');
      expect(issues.first.message, contains('`item_few`'));
      expect(issues.first.message, contains('`item_many`'));
    });

    test('judges the target language too', () {
      final issues = check(Chki18nCheckCode.noPluralForm, const {
        'en': {'item_one': '1 item'},
        'ko': {'item_other': '{count}개'},
      });

      expect(issues.length, 1);
      expect(issues.first.locale, 'en');
    });

    test('says nothing about a language it has no table for', () {
      expect(
        check(Chki18nCheckCode.noPluralForm, {
          ...forms,
          'mt': const {'item_one': '1 oggett'},
        }),
        isEmpty,
      );
    });

    test('leaves the older plural convention as ordinary keys', () {
      expect(
        check(Chki18nCheckCode.noPluralForm, const {
          'en': {'item': '1 item', 'item_plural': '{count} items'},
        }),
        isEmpty,
      );
    });
  });

  group('plural forms and the keys they excuse', () {
    test('does not ask a language for a form it never uses', () {
      expect(
        check(Chki18nCheckCode.noKey, const {
          'en': {'item_one': '1 item', 'item_other': '{count} items'},
          'ko': {'item_other': '{count}개'},
        }),
        isEmpty,
      );
    });

    test('still asks for the forms the language does use', () {
      final issues = check(Chki18nCheckCode.noKey, const {
        'en': {'item_one': '1 item', 'item_other': '{count} items'},
        'ko': {'item_one': '1개'},
      });

      expect(issues.length, 1);
      expect(issues.first.key, 'item_other');
    });

    test('does not call a form the target has no use for a stray key', () {
      expect(
        check(Chki18nCheckCode.dummyKey, const {
          'ko': {'item_other': '{count}개'},
          'ru': {'item_other': '{count}', 'item_few': '{count} элемента'},
        }),
        isEmpty,
      );
    });

    test('leaves a language it has no table for exactly as it was', () {
      final issues = check(Chki18nCheckCode.noKey, const {
        'en': {'item_one': '1 item', 'item_other': '{count} items'},
        'mt': {'item_one': '1 oggett'},
      });

      expect(issues.length, 1);
      expect(issues.first.key, 'item_other');
    });
  });

  group('the plural primitives', () {
    test('reads the form a suffixed key names', () {
      expect(pluralPartsOf('item_one')?.base, 'item');
      expect(pluralPartsOf('item_one')?.category, Chki18nPluralCategory.one);
      expect(pluralPartsOf('item'), isNull);
      expect(pluralPartsOf('item_plural'), isNull);
      expect(pluralPartsOf('_one'), isNull);
    });

    test('reads the base of either plural convention', () {
      expect(pluralBaseOf('item_one'), 'item');
      expect(pluralBaseOf('item_plural'), 'item');
      expect(pluralBaseOf('item'), isNull);
    });

    test('knows what each language needs, and admits what it does not know', () {
      expect(pluralCategoriesOf('ko'), [Chki18nPluralCategory.other]);
      expect(pluralCategoriesOf('en-GB'), [Chki18nPluralCategory.one, Chki18nPluralCategory.other]);
      expect(pluralCategoriesOf('ru'), [
        Chki18nPluralCategory.one,
        Chki18nPluralCategory.few,
        Chki18nPluralCategory.many,
        Chki18nPluralCategory.other,
      ]);
      expect(pluralCategoriesOf('mt'), isNull);
    });
  });

  group('KEY_NAMING', () {
    List<Chki18nIssue> keys({Chki18nKeyCase? keyCase}) => check(Chki18nCheckCode.keyNaming, const {
      'en': {'attr-folder': 'A', 'badKey_Name': 'B'},
    }, keyCase: keyCase);

    test('reports nothing until `keyCase` says what the project uses', () {
      expect(keys(), isEmpty);
    });

    test('finds the key that is not written in the chosen case', () {
      final issues = keys(keyCase: Chki18nKeyCase.kebab);

      expect(issues.length, 1);
      expect(issues.first.key, 'badKey_Name');
      expect(issues.first.locale, '');
    });

    test('judges every level of a nested key', () {
      final issues = check(Chki18nCheckCode.keyNaming, const {
        'en': {'attr.badName': 'A'},
      }, keyCase: Chki18nKeyCase.kebab);

      expect(issues.length, 1);
      expect(issues.first.message, contains('`badName`'));
    });

    test('accepts the plural suffix an i18n library appends', () {
      expect(
        check(Chki18nCheckCode.keyNaming, const {
          'en': {'item-count_one': 'A'},
        }, keyCase: Chki18nKeyCase.kebab),
        isEmpty,
      );
    });

    test('reports a key once however many parts of it are wrong', () {
      expect(
        check(Chki18nCheckCode.keyNaming, const {
          'en': {'Bad.Worse': 'A'},
        }, keyCase: Chki18nKeyCase.kebab).length,
        1,
      );
    });

    test('accepts camel case when that is what was asked for', () {
      expect(
        check(Chki18nCheckCode.keyNaming, const {
          'en': {'attrFolder': 'A'},
        }, keyCase: Chki18nKeyCase.camel),
        isEmpty,
      );
    });
  });

  group('KEY_DEPTH', () {
    test('reports nothing until `maxKeyDepth` says how deep is too deep', () {
      expect(
        check(Chki18nCheckCode.keyDepth, const {
          'en': {'a.b.c.d': 'A'},
        }),
        isEmpty,
      );
    });

    test('finds the key nested past the limit', () {
      final issues = check(Chki18nCheckCode.keyDepth, const {
        'en': {'a.b.c.d': 'A', 'a.b': 'B'},
      }, maxKeyDepth: 2);

      expect(issues.length, 1);
      expect(issues.first.key, 'a.b.c.d');
      expect(issues.first.message, contains('4 levels deep'));
    });
  });

  group('checkEntry', () {
    test('answers the checks a single key can answer', () {
      final issues = createAnalyzer(
        options: const Chki18nOptions(target: 'en', keyCase: Chki18nKeyCase.kebab, maxKeyDepth: 1),
      ).checkEntry(const Chki18nEntry(key: 'badName', values: {'en': '{a} and {a}', 'ko': '{a}'}));
      final codes = [for (final issue in issues) issue.code];

      expect(codes, contains(Chki18nCheckCode.keyNaming));
      expect(codes, contains(Chki18nCheckCode.interpolationCount));
    });
  });

  group('the value primitives', () {
    test('reads markup tags as they were written', () {
      expect(extractTags('a <b>c</b> <br/>'), ['<b>', '</b>', '<br/>']);
      expect(extractTags('no markup here'), isEmpty);
    });

    test('keeps a padded number apart from a bare one', () {
      expect(extractNumbers('Step 03 of 5'), ['03', '5']);
    });

    test('finds the first character nothing will draw', () {
      expect(findInvisibleCharacter('ab${zeroWidthSpace}c'), zeroWidthSpace);
      expect(findInvisibleCharacter('plain'), isNull);
    });

    test('knows which script a language is written in', () {
      expect(scriptOfLocale('ko')?.hasMatch('가'), isTrue);
      expect(scriptOfLocale('ja-JP')?.hasMatch('あ'), isTrue);
      expect(scriptOfLocale('en'), isNull);
      expect(scriptOfLocale('sr-Latn'), isNull);
    });

    test('does not count a placeholder or a tag as words of its own', () {
      expect(hasTranslatableText('{name}', '{', '}'), isFalse);
      expect(hasTranslatableText('<br/>', '{', '}'), isFalse);
      expect(hasTranslatableText('Hi {name}', '{', '}'), isTrue);
    });
  });

  group('the target language', () {
    test('reports an empty value of its own', () {
      final issues = checkAll({
        'en': {'a': ''},
        'ko': {'a': '비어 있음'},
      });

      expect(issues, hasLength(1));
      expect(issues.first.code, Chki18nCheckCode.emptyValue);
    });

    test('reports the whitespace around a value of its own', () {
      final issues = checkAll({
        'en': {'a': 'Save '},
        'ko': {'a': '저장'},
      });

      expect(issues, hasLength(1));
      expect(issues.first.code, Chki18nCheckCode.surroundingWhitespace);
    });

    test('reports a character of its own that nothing will draw', () {
      final issues = checkAll({
        'en': {'a': 'Sign${zeroWidthSpace}in'},
        'ko': {'a': '로그인'},
      });

      expect(issues, hasLength(1));
      expect(issues.first.code, Chki18nCheckCode.invisibleCharacter);
      expect(issues.first.message, contains('zero width space'));
    });

    test('reports a value of its own that is not a string', () {
      final issues = checkAll({
        'en': {'a': 42},
        'ko': {'a': '42'},
      });

      expect(issues, hasLength(1));
      expect(issues.first.code, Chki18nCheckCode.invalidValueType);
    });

    test('reports a value of its own written in the wrong script', () {
      final issues =
          analyzeTranslations(
            const Chki18nInput(
              locales: {
                'ko': {'a': 'Hello'},
                'en': {'a': 'Hello'},
              },
            ),
            options: const Chki18nOptions(
              target: 'ko',
              flattened: true,
              checks: [Chki18nCheckCode.untranslatedScript],
            ),
          ).issues;

      expect(issues, hasLength(1));
      expect(issues.first.locale, 'ko');
      expect(issues.first.code, Chki18nCheckCode.untranslatedScript);
    });

    test('quotes nothing beside a finding of its own, having nothing to compare it to', () {
      final issues = checkAll({
        'en': {'a': 'Save '},
        'ko': {'a': '저장'},
      });

      expect(issues.first.targetValue, isNull);
      expect(issues.first.value, 'Save ');
    });

    test('never disagrees with itself, whatever the value holds', () {
      expect(
        checkAll({
          'en': {'a': 'Hello <b>{name}</b>, you have 3 of {count}'},
          'ko': {'a': '안녕하세요 <b>{name}</b>님, {count} 중 3개가 있습니다'},
        }, lengthRatio: 2),
        isEmpty,
      );
    });

    test('is still what the other locales are compared against', () {
      final result = analyzeTranslations(
        const Chki18nInput(
          locales: {
            'en': {'a': 'Save '},
            'ko': {'a': 'Save '},
          },
        ),
        options: const Chki18nOptions(target: 'en', flattened: true),
      );

      expect(
        result.of(Chki18nCheckCode.surroundingWhitespace).map((issue) => issue.locale).toList(),
        ['en', 'ko'],
      );
      expect(result.of(Chki18nCheckCode.notTranslatedValue).map((issue) => issue.locale).toList(), [
        'ko',
      ]);
    });

    test('can be silenced like any other locale, by switching the check off', () {
      expect(
        checkAll(
          {
            'en': {'a': ''},
            'ko': {'a': '비어 있음'},
          },
          ignoreChecks: [Chki18nCheckCode.emptyValue],
        ),
        isEmpty,
      );
    });
  });
}
