import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { NUSACH_OPTIONS } from '../constants/nusach';
import { colors, radius, spacing } from '../constants/theme';
import { OmerPreposition, SettingsState } from '../types';

interface Props {
  settings: SettingsState;
  missedOverride: boolean;
  onUpdateSettings: (patch: Partial<SettingsState>) => Promise<void>;
  onMarkMissedEarlier: () => Promise<void>;
  onClearMissedEarlier: () => Promise<void>;
  onResetCycle: () => Promise<void>;
}

const snoozeOptions: Array<10 | 20 | 30> = [10, 20, 30];

// Hardcore = every 10 min, escalation on, screen lock active
// Chill    = every 60 min, escalation off
const isHardcoreSelected = (s: SettingsState) => s.hardcoreMode && s.reminderBaseMinutes <= 15;
const isChillSelected = (s: SettingsState) => !s.hardcoreMode && s.reminderBaseMinutes >= 45;

export const SettingsScreen = ({
  settings,
  missedOverride,
  onUpdateSettings,
  onMarkMissedEarlier,
  onClearMissedEarlier,
  onResetCycle
}: Props) => {
  const [fallbackTimeInput, setFallbackTimeInput] = useState(settings.fallbackTzeit);
  const [busy, setBusy] = useState(false);

  const canSaveFallbackTime = useMemo(
    () => /^\d{2}:\d{2}$/.test(fallbackTimeInput.trim()),
    [fallbackTimeInput]
  );

  const guarded = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>General</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Show bracha</Text>
          <Switch
            value={settings.showBracha}
            onValueChange={(value) =>
              guarded(() => onUpdateSettings({ showBracha: value }))
            }
            thumbColor={colors.textPrimary}
            trackColor={{ false: '#3C4254', true: colors.accentMuted }}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.rowLabelGroup}>
            <Text style={styles.rowLabel}>Morning catch-up</Text>
            <Text style={styles.rowSubLabel}>Hourly reminders 7am–12pm if you didn't count at night (no bracha)</Text>
          </View>
          <Switch
            value={settings.morningCatchupEnabled}
            onValueChange={(value) =>
              guarded(() => onUpdateSettings({ morningCatchupEnabled: value }))
            }
            thumbColor={colors.textPrimary}
            trackColor={{ false: '#3C4254', true: colors.accentMuted }}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Nusach style</Text>
        <View style={styles.pillRow}>
          {NUSACH_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.pill,
                settings.nusach === option.key && styles.pillSelected
              ]}
              onPress={() => guarded(() => onUpdateSettings({ nusach: option.key }))}
            >
              <Text
                style={[
                  styles.pillLabel,
                  settings.nusach === option.key && styles.pillLabelSelected
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Omer count text</Text>
        <Text style={styles.secondaryLabel}>Preposition for the count</Text>
        <View style={styles.pillRow}>
          {([
            { key: 'baomer' as OmerPreposition, label: 'בעומר' },
            { key: 'laomer' as OmerPreposition, label: 'לעומר' }
          ]).map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.pill,
                settings.omerPreposition === option.key && styles.pillSelected
              ]}
              onPress={() => guarded(() => onUpdateSettings({ omerPreposition: option.key }))}
            >
              <Text
                style={[
                  styles.pillLabel,
                  styles.hebrewPillLabel,
                  settings.omerPreposition === option.key && styles.pillLabelSelected
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Reminder mode</Text>
        <View style={styles.pillRow}>
          <TouchableOpacity
            style={[styles.pill, styles.pillWide, isHardcoreSelected(settings) && styles.pillSelected]}
            onPress={() =>
              guarded(() =>
                onUpdateSettings({
                  hardcoreMode: true,
                  reminderBaseMinutes: 10,
                  escalationEnabled: true
                })
              )
            }
          >
            <Text style={[styles.pillLabel, isHardcoreSelected(settings) && styles.pillLabelSelected]}>
              Hardcore — every 10 min
            </Text>
            <Text style={[styles.pillSubLabel, isHardcoreSelected(settings) && styles.pillLabelSelected]}>
              Screen lock · escalates after 30 min
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, styles.pillWide, isChillSelected(settings) && styles.pillSelected]}
            onPress={() =>
              guarded(() =>
                onUpdateSettings({
                  hardcoreMode: false,
                  reminderBaseMinutes: 60,
                  escalationEnabled: false
                })
              )
            }
          >
            <Text style={[styles.pillLabel, isChillSelected(settings) && styles.pillLabelSelected]}>
              Chill — every hour
            </Text>
            <Text style={[styles.pillSubLabel, isChillSelected(settings) && styles.pillLabelSelected]}>
              No lock screen · no escalation
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.secondaryLabel}>Default snooze</Text>
        <View style={styles.pillRow}>
          {snoozeOptions.map((value) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.pill,
                settings.defaultSnoozeMinutes === value && styles.pillSelected
              ]}
              onPress={() =>
                guarded(() => onUpdateSettings({ defaultSnoozeMinutes: value }))
              }
            >
              <Text
                style={[
                  styles.pillLabel,
                  settings.defaultSnoozeMinutes === value && styles.pillLabelSelected
                ]}
              >
                {value}m
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Fallback tzeit (HH:MM)</Text>
        <TextInput
          value={fallbackTimeInput}
          onChangeText={setFallbackTimeInput}
          style={styles.input}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          placeholder="20:30"
          placeholderTextColor={colors.textSecondary}
        />
        <TouchableOpacity
          disabled={!canSaveFallbackTime || busy}
          style={[
            styles.action,
            (!canSaveFallbackTime || busy) && styles.disabled
          ]}
          onPress={() =>
            guarded(() =>
              onUpdateSettings({ fallbackTzeit: fallbackTimeInput.trim() })
            )
          }
        >
          <Text style={styles.actionText}>Save fallback time</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Halachic Status</Text>
        <TouchableOpacity
          style={styles.outlineAction}
          onPress={() => guarded(() => onMarkMissedEarlier())}
        >
          <Text style={styles.outlineActionText}>I missed a day</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.outlineAction}
          onPress={() => guarded(() => onClearMissedEarlier())}
        >
          <Text style={styles.outlineActionText}>
            I did not miss a day ({missedOverride ? 'Off for bracha' : 'Bracha on'})
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={() => guarded(() => onResetCycle())}
        >
          <Text style={styles.resetButtonText}>Reset this Omer cycle</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingBottom: spacing.xl
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    letterSpacing: 0.4
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  rowLabelGroup: {
    flex: 1,
    marginRight: 12
  },
  rowLabel: {
    color: colors.textSecondary,
    fontFamily: 'SpaceGrotesk_400Regular'
  },
  rowSubLabel: {
    color: colors.textSecondary,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  pill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface
  },
  pillSelected: {
    borderColor: colors.accent,
    backgroundColor: '#123A31'
  },
  pillWide: {
    flex: 1,
    paddingVertical: spacing.sm
  },
  pillLabel: {
    color: colors.textSecondary,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  pillSubLabel: {
    color: colors.textSecondary,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 11,
    opacity: 0.7,
    marginTop: 2
  },
  hebrewPillLabel: {
    fontFamily: 'FrankRuhlLibre_600SemiBold',
    fontSize: 18
  },
  pillLabelSelected: {
    color: colors.textPrimary
  },
  secondaryLabel: {
    color: colors.textSecondary,
    fontFamily: 'SpaceGrotesk_400Regular',
    marginTop: spacing.sm
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontFamily: 'SpaceGrotesk_400Regular',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  action: {
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm
  },
  actionText: {
    textAlign: 'center',
    color: '#041311',
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  disabled: {
    opacity: 0.5
  },
  outlineAction: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm
  },
  outlineActionText: {
    textAlign: 'center',
    color: colors.textPrimary,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  resetButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: spacing.sm
  },
  resetButtonText: {
    textAlign: 'center',
    color: colors.danger,
    fontFamily: 'SpaceGrotesk_700Bold'
  }
});
