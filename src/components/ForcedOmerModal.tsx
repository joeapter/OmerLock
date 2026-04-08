import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import { colors, radius, spacing } from '../constants/theme';
import { CompletionMethod, NusachKey, OmerPreposition } from '../types';
import { getNusachText } from '../utils/omerText';

interface Props {
  visible: boolean;
  day: number;
  countWindow: 'tonight' | 'last_night';
  nusach: NusachKey;
  omerPreposition: OmerPreposition;
  brachaAllowed: boolean;
  hardcoreMode: boolean;
  defaultSnooze: 10 | 20 | 30;
  reviewOnly?: boolean;
  onReviewClose?: () => void;
  onCountComplete: (method: CompletionMethod) => Promise<void>;
  onSnooze: (minutes: 10 | 20 | 30) => Promise<void>;
  onAlreadyCounted: () => Promise<void>;
  onMissedEarlier: () => Promise<void>;
  onDismissAfterAction: () => void;
}

export const ForcedOmerModal = ({
  visible,
  day,
  countWindow,
  nusach,
  omerPreposition,
  brachaAllowed,
  hardcoreMode,
  defaultSnooze,
  reviewOnly = false,
  onReviewClose,
  onCountComplete,
  onSnooze,
  onAlreadyCounted,
  onMissedEarlier,
  onDismissAfterAction
}: Props) => {
  const [busy, setBusy] = useState(false);
  const snoozeOptions = [
    defaultSnooze,
    ...[10, 20, 30].filter((value) => value !== defaultSnooze)
  ] as Array<10 | 20 | 30>;
  const possessiveLabel = countWindow === 'tonight' ? "Tonight's" : "Last night's";

  const nusachText = getNusachText(day, nusach, brachaAllowed, omerPreposition);

  const withBusy = async (action: () => Promise<void>, keepOpen = false) => {
    setBusy(true);
    try {
      await action();
      if (!keepOpen) {
        onDismissAfterAction();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {reviewOnly ? (
            <View style={styles.reviewHeader}>
              <View />
              <TouchableOpacity onPress={onReviewClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <Text style={styles.title}>{possessiveLabel} Omer Count</Text>
          <Text style={styles.subtitle}>
            {reviewOnly
              ? `Review ${possessiveLabel.toLowerCase()} bracha and count details.`
              : `Complete ${possessiveLabel.toLowerCase()} count to clear reminders.`}
          </Text>

          {!brachaAllowed ? (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>Continue counting without a bracha</Text>
            </View>
          ) : null}

          <View style={styles.textBlock}>
            <Text style={styles.hebrewHeading}>ברכה</Text>
            <Text style={styles.hebrewText}>{nusachText.bracha}</Text>
          </View>

          <View style={styles.textBlock}>
            <Text style={styles.hebrewHeading}>ספירה</Text>
            <Text style={styles.hebrewText}>{nusachText.countHebrew}</Text>
            <Text style={styles.englishText}>{nusachText.countEnglish}</Text>
          </View>

          <View style={styles.textBlock}>
            <Text style={styles.hebrewHeading}>הרחמן</Text>
            <Text style={styles.hebrewText}>{nusachText.harachaman}</Text>
          </View>

          {!reviewOnly ? (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.primaryButton, busy && styles.disabled]}
                disabled={busy}
                onPress={() => withBusy(() => onCountComplete('swipe_hold'))}
              >
                <Text style={styles.primaryButtonText}>I Counted</Text>
              </TouchableOpacity>

              <View style={styles.snoozeCard}>
                <Text style={styles.snoozeTitle}>Snooze reminder</Text>
                <View style={styles.snoozeRow}>
                  {snoozeOptions.map((minutes) => (
                    <TouchableOpacity
                      key={minutes}
                      disabled={busy}
                      style={[styles.snoozePill, busy && styles.disabled]}
                      onPress={() =>
                        withBusy(
                          () => onSnooze(minutes as 10 | 20 | 30),
                          hardcoreMode
                        )
                      }
                    >
                      <Text style={styles.snoozeText}>
                        {minutes}m{minutes === defaultSnooze ? ' default' : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {hardcoreMode ? (
                  <Text style={styles.hardcoreHint}>
                    Hardcore mode: reminders every 5 min until you count.
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity
                style={[styles.secondaryButton, busy && styles.disabled]}
                disabled={busy}
                onPress={() => withBusy(onAlreadyCounted)}
              >
                <Text style={styles.secondaryButtonText}>Already Counted</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, busy && styles.disabled]}
                disabled={busy}
                onPress={() => withBusy(onMissedEarlier, true)}
              >
                <Text style={styles.secondaryButtonText}>I missed a day</Text>
              </TouchableOpacity>
            </View>
          ) : null}

        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  closeButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface
  },
  closeButtonText: {
    color: colors.textPrimary,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12
  },
  title: {
    color: colors.textPrimary,
    fontSize: 30,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  subtitle: {
    color: colors.textSecondary,
    lineHeight: 22,
    fontFamily: 'SpaceGrotesk_400Regular'
  },
  warningBox: {
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: '#352C11',
    borderRadius: radius.md,
    padding: spacing.md
  },
  warningText: {
    color: colors.warning,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  textBlock: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm
  },
  hebrewHeading: {
    color: colors.accent,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    letterSpacing: 1.1
  },
  hebrewText: {
    color: colors.textPrimary,
    fontFamily: 'FrankRuhlLibre_600SemiBold',
    fontSize: 23,
    lineHeight: 34,
    textAlign: 'right'
  },
  englishText: {
    color: colors.textSecondary,
    fontFamily: 'SpaceGrotesk_400Regular',
    lineHeight: 21
  },
  actions: {
    gap: spacing.sm
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md
  },
  primaryButtonText: {
    color: '#03110D',
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  snoozeCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm
  },
  snoozeTitle: {
    color: colors.textPrimary,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  snoozeRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  snoozePill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.sm,
    flex: 1
  },
  snoozeText: {
    color: colors.textSecondary,
    textAlign: 'center',
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  hardcoreHint: {
    color: colors.warning,
    fontFamily: 'SpaceGrotesk_400Regular'
  },
  secondaryButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface
  },
  secondaryButtonText: {
    textAlign: 'center',
    color: colors.textPrimary,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  disabled: {
    opacity: 0.55
  }
});
