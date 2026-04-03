import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, radius, spacing } from '../constants/theme';
import { OmerRuntime } from '../types';
import { formatClock } from '../utils/date';
import { getEnglishCountText, getHebrewCountText } from '../utils/omerText';

interface Props {
  runtime: OmerRuntime;
  isTodayCompleted: boolean;
  brachaAllowed: boolean;
  streak: number;
  missedFullDay: boolean;
  onOpenModal: () => void;
}

export const HomeScreen = ({
  runtime,
  isTodayCompleted,
  brachaAllowed,
  streak,
  missedFullDay,
  onOpenModal
}: Props) => {
  if (!runtime.inSefira || runtime.activeDay === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.headline}>Not in Omer season</Text>
        <Text style={styles.subline}>
          Reminders will start automatically when Sefiras HaOmer begins.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.card, styles.heroCard]}>
        <Text style={styles.kicker}>Tonight's Count</Text>
        <Text style={styles.dayNumber}>Day {runtime.activeDay}</Text>
        <Text style={styles.hebrewLine}>{getHebrewCountText(runtime.activeDay)}</Text>
        <Text style={styles.englishLine}>{getEnglishCountText(runtime.activeDay)}</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Tonight</Text>
          <Text style={[styles.metricValue, isTodayCompleted && styles.done]}>
            {isTodayCompleted ? 'Counted' : 'Waiting'}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Current streak</Text>
          <Text style={styles.metricValue}>{streak} days</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.metricLabel}>Next reminder</Text>
        <Text style={styles.bigTime}>{formatClock(runtime.tzeitToday)}</Text>
        <View style={styles.sourceBadge}>
          <Text style={styles.sourceText}>
            Timing: {runtime.tzeitSource === 'hebcal' ? 'Hebcal (location)' : 'Fallback time'}
          </Text>
        </View>
      </View>

      {!brachaAllowed || missedFullDay ? (
        <View style={styles.alertCard}>
          <Text style={styles.alertText}>Continue counting without a bracha</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.primaryButton} onPress={onOpenModal}>
        <Text style={styles.primaryText}>
          {isTodayCompleted ? "Review tonight's count" : "Open tonight's count"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.md
  },
  headline: {
    color: colors.textPrimary,
    fontSize: 26,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  subline: {
    color: colors.textSecondary,
    fontFamily: 'SpaceGrotesk_400Regular',
    lineHeight: 21
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md + 2,
    gap: spacing.sm
  },
  heroCard: {
    backgroundColor: '#122229',
    borderColor: '#1F4A3A'
  },
  kicker: {
    color: colors.accent,
    letterSpacing: 1.6,
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
    fontSize: 12
  },
  dayNumber: {
    color: colors.textPrimary,
    fontSize: 40,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  hebrewLine: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 34,
    fontFamily: 'FrankRuhlLibre_600SemiBold',
    textAlign: 'right'
  },
  englishLine: {
    color: colors.textSecondary,
    lineHeight: 22,
    fontFamily: 'SpaceGrotesk_400Regular'
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  metric: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    gap: spacing.xs
  },
  metricLabel: {
    color: colors.textSecondary,
    fontFamily: 'SpaceGrotesk_400Regular'
  },
  metricValue: {
    color: colors.textPrimary,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18
  },
  done: {
    color: colors.accent
  },
  bigTime: {
    color: colors.textPrimary,
    fontSize: 34,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  sourceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border
  },
  sourceText: {
    color: colors.textSecondary,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12
  },
  alertCard: {
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    backgroundColor: '#352C11',
    padding: spacing.md
  },
  alertText: {
    color: colors.warning,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md + 2
  },
  primaryText: {
    color: '#02110D',
    textAlign: 'center',
    fontFamily: 'SpaceGrotesk_700Bold'
  }
});
