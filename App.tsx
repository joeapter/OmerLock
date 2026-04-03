import { FrankRuhlLibre_600SemiBold } from '@expo-google-fonts/frank-ruhl-libre';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_700Bold
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AppState,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import { ForcedOmerModal } from './src/components/ForcedOmerModal';
import { OmerBanner } from './src/components/OmerBanner';
import { OpeningScreen } from './src/components/OpeningScreen';
import { colors, radius, spacing } from './src/constants/theme';
import { addNotificationListeners } from './src/services/notificationService';
import { HomeScreen } from './src/screens/HomeScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { OmerLockProvider, useOmerLock } from './src/state/OmerLockContext';

type ScreenKey = 'home' | 'history' | 'settings';
type TabIconName = React.ComponentProps<typeof Ionicons>['name'];

const tabs: Array<{
  key: ScreenKey;
  label: string;
  icon: TabIconName;
  activeIcon: TabIconName;
}> = [
  { key: 'home', label: 'Today', icon: 'home-outline', activeIcon: 'home' },
  {
    key: 'history',
    label: 'History',
    icon: 'time-outline',
    activeIcon: 'time'
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: 'settings-outline',
    activeIcon: 'settings'
  }
];

const AppShell = () => {
  const {
    state,
    runtime,
    loading,
    refreshRuntime,
    markDayCompleted,
    markAlreadyCounted,
    setMissedEarlierOverride,
    clearMissedEarlierOverride,
    snooze,
    updateSettings,
    resetCycleData,
    isTodayCompleted,
    shouldShowLockModal,
    brachaAllowed
  } = useOmerLock();

  const [screen, setScreen] = useState<ScreenKey>('home');
  const [notificationForcedModal, setNotificationForcedModal] = useState(false);

  useEffect(() => {
    const listener = addNotificationListeners(() => {
      setNotificationForcedModal(true);
      refreshRuntime().catch(() => undefined);
    });

    return () => listener.remove();
  }, [refreshRuntime]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        refreshRuntime().catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, [refreshRuntime]);

  useEffect(() => {
    if (isTodayCompleted) {
      setNotificationForcedModal(false);
    }
  }, [isTodayCompleted]);

  const lockModalVisible =
    runtime.inSefira &&
    runtime.activeDay !== null &&
    !isTodayCompleted &&
    (shouldShowLockModal || notificationForcedModal);

  const hardcoreNavigationLock =
    state.settings.hardcoreMode &&
    runtime.inSefira &&
    runtime.activeDay !== null &&
    !isTodayCompleted;
  const showHardcoreBanner = state.settings.hardcoreMode;
  const hardcoreBannerText = hardcoreNavigationLock
    ? "Hardcore mode is on. Complete tonight's count to unlock the app."
    : 'Hardcore mode is active. The app locks each night until you count.';

  const pageSubtitle = useMemo(() => {
    if (screen === 'history') {
      return 'Your 49-night timeline';
    }
    if (screen === 'settings') {
      return 'Reminder and nusach settings';
    }
    return "Tonight's count at a glance";
  }, [screen]);

  if (loading) {
    return <OpeningScreen />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.appTitle}>OmerLock</Text>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })}
          </Text>
        </View>
        <Text style={styles.pageSubtitle}>{pageSubtitle}</Text>
      </View>

      {showHardcoreBanner ? (
        <View style={styles.bannerWrap}>
          <OmerBanner text={hardcoreBannerText} />
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {screen === 'home' ? (
          <HomeScreen
            runtime={runtime}
            isTodayCompleted={isTodayCompleted}
            brachaAllowed={brachaAllowed}
            streak={state.streak}
            missedFullDay={state.missedFullDay}
            onOpenModal={() => setNotificationForcedModal(true)}
          />
        ) : null}

        {screen === 'history' ? (
          <HistoryScreen
            completions={state.completions}
            activeDay={runtime.activeDay}
            missedDays={state.missedDays}
          />
        ) : null}

        {screen === 'settings' ? (
          <SettingsScreen
            settings={state.settings}
            missedOverride={state.overrideMissedEarlier}
            onUpdateSettings={updateSettings}
            onMarkMissedEarlier={setMissedEarlierOverride}
            onClearMissedEarlier={clearMissedEarlierOverride}
            onResetCycle={resetCycleData}
          />
        ) : null}
      </ScrollView>

      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const active = tab.key === screen;
          return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => {
              if (hardcoreNavigationLock) {
                return;
              }
              setScreen(tab.key);
            }}
            disabled={hardcoreNavigationLock}
          >
            <View
              style={[
                styles.tabIndicator,
                active && styles.tabIndicatorActive
              ]}
            />
            <Ionicons
              name={active ? tab.activeIcon : tab.icon}
              size={20}
              color={active ? colors.tabActive : colors.tabInactive}
            />
            <Text style={[styles.tabText, active && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
          );
        })}
      </View>

      {runtime.inSefira && runtime.activeDay !== null ? (
        <ForcedOmerModal
          visible={lockModalVisible}
          day={runtime.activeDay}
          nusach={state.settings.nusach}
          brachaAllowed={brachaAllowed}
          hardcoreMode={state.settings.hardcoreMode}
          defaultSnooze={state.settings.defaultSnoozeMinutes}
          onCountComplete={markDayCompleted}
          onSnooze={snooze}
          onAlreadyCounted={markAlreadyCounted}
          onMissedEarlier={setMissedEarlierOverride}
          onDismissAfterAction={() => setNotificationForcedModal(false)}
        />
      ) : null}
    </SafeAreaView>
  );
};

export default function App() {
  const [openingDelayDone, setOpeningDelayDone] = useState(false);
  const [fontsLoaded] = useFonts({
    FrankRuhlLibre_600SemiBold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_700Bold
  });

  useEffect(() => {
    const timeout = setTimeout(() => {
      setOpeningDelayDone(true);
    }, 2500);

    return () => clearTimeout(timeout);
  }, []);

  if (!fontsLoaded || !openingDelayDone) {
    return <OpeningScreen />;
  }

  return (
    <OmerLockProvider>
      <AppShell />
    </OmerLockProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  appTitle: {
    color: colors.textPrimary,
    fontSize: 28,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  dateText: {
    color: colors.textSecondary,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 13
  },
  pageSubtitle: {
    color: colors.textSecondary,
    fontFamily: 'SpaceGrotesk_400Regular',
    marginTop: 2
  },
  bannerWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + 30
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    backgroundColor: colors.tabBar
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
    gap: 2
  },
  tabIndicator: {
    height: 2,
    width: 34,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
    marginBottom: 4
  },
  tabIndicatorActive: {
    backgroundColor: colors.tabActive
  },
  tabText: {
    textAlign: 'center',
    color: colors.tabInactive,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12
  },
  tabTextActive: {
    color: colors.tabActive
  }
});
