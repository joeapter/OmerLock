import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../constants/theme';
import { CompletionRecord } from '../types';

interface Props {
  completions: Record<string, CompletionRecord>;
  activeDay: number | null;
  missedDays: number[];
}

const statusForDay = (
  day: number,
  completions: Record<string, CompletionRecord>,
  activeDay: number | null,
  missedDays: number[]
): { label: string; color: string } => {
  if (completions[String(day)]) {
    return { label: 'Done', color: colors.accent };
  }

  if (missedDays.includes(day)) {
    return { label: 'Missed full day', color: colors.warning };
  }

  if (activeDay !== null && day === activeDay) {
    return { label: 'Tonight', color: colors.textPrimary };
  }

  if (activeDay !== null && day > activeDay) {
    return { label: 'Upcoming', color: colors.textSecondary };
  }

  return { label: 'Not counted', color: colors.textSecondary };
};

export const HistoryScreen = ({ completions, activeDay, missedDays }: Props) => (
  <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
    <View style={styles.headerCard}>
      <Text style={styles.headerTitle}>Omer Timeline</Text>
      <Text style={styles.headerSubtitle}>
        Track each night, completion time, and halachic status.
      </Text>
    </View>

    <View style={styles.listCard}>
      {Array.from({ length: 49 }, (_, idx) => idx + 1).map((day) => {
        const status = statusForDay(day, completions, activeDay, missedDays);
        const completion = completions[String(day)];

        return (
          <View key={day} style={styles.row}>
            <View style={styles.leftGroup}>
              <View style={styles.dayBubble}>
                <Text style={styles.dayBubbleText}>{day}</Text>
              </View>
              <View>
                <Text style={styles.dayTitle}>Day {day}</Text>
                {completion ? (
                  <Text style={styles.meta}>
                    {new Date(completion.timestamp).toLocaleString()} • {completion.method}
                  </Text>
                ) : null}
              </View>
            </View>

            <Text style={[styles.status, { color: status.color }]}>{status.label}</Text>
          </View>
        );
      })}
    </View>
  </ScrollView>
);

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.xl,
    gap: spacing.sm
  },
  headerCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md + 2,
    marginBottom: spacing.sm,
    gap: spacing.xs
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontFamily: 'SpaceGrotesk_400Regular',
    lineHeight: 20
  },
  listCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated
  },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1
  },
  dayBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A4D3A'
  },
  dayBubbleText: {
    color: '#D3FFE8',
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  dayTitle: {
    color: colors.textPrimary,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16
  },
  meta: {
    color: colors.textSecondary,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 12
  },
  status: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12
  }
});
