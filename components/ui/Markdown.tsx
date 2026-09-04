import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '@/theme';

/**
 * A very small Markdown renderer — headings, paragraphs, bullets, quotes and
 * **bold**. Deliberately dependency-free: the article is written as Markdown so
 * it reads as a document and can come straight from the model later, but a
 * whole Markdown library is far more than these few marks need.
 */
export function Markdown({ source }: { source: string }) {
  const blocks = source.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <View style={styles.doc}>
      {blocks.map((block, index) => {
        if (block.startsWith('### ')) {
          return (
            <Text key={index} style={styles.h3} accessibilityRole="header">
              {block.slice(4)}
            </Text>
          );
        }
        if (block.startsWith('## ')) {
          return (
            <Text key={index} style={styles.h2} accessibilityRole="header">
              {block.slice(3)}
            </Text>
          );
        }
        if (block.startsWith('> ')) {
          return (
            <View key={index} style={styles.quote}>
              <Text style={styles.quoteText}>{inline(block.slice(2))}</Text>
            </View>
          );
        }
        if (/^[-*] /m.test(block)) {
          const items = block.split('\n').map((l) => l.replace(/^[-*]\s+/, ''));
          return (
            <View key={index} style={styles.list}>
              {items.map((item, i) => (
                <View key={i} style={styles.listRow}>
                  <Text style={styles.bullet}>—</Text>
                  <Text style={styles.body}>{inline(item)}</Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={index} style={styles.body}>
            {inline(block)}
          </Text>
        );
      })}
    </View>
  );
}

/** Splits on **bold** and returns the pieces. */
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <Text key={i} style={styles.strong}>
        {part.slice(2, -2)}
      </Text>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

const styles = StyleSheet.create({
  doc: { gap: spacing.md },
  h2: {
    fontFamily: fonts.serif,
    fontSize: 20,
    lineHeight: 30,
    color: colors.ivory,
    marginTop: spacing.sm,
  },
  h3: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 2.4,
    color: colors.ivoryFaint,
    marginTop: spacing.sm,
  },
  body: { flex: 1, fontFamily: fonts.serif, fontSize: 16, lineHeight: 29, color: colors.ivory },
  strong: { color: colors.brass },
  list: { gap: spacing.sm },
  listRow: { flexDirection: 'row', gap: spacing.sm },
  bullet: { color: colors.brassDim, fontSize: 15, lineHeight: 29 },
  quote: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.brassDim,
    paddingLeft: spacing.md,
  },
  quoteText: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 27,
    color: colors.ivoryDim,
    fontStyle: 'italic',
  },
});
