import Tabs from 'expo-router/js-tabs';
import { BottomNav } from '@components/navigation/BottomNav';
import { colors } from '@/theme';

/**
 * 方向性マップ | 入力 | 足跡データ | マイページ.
 *
 * 方向性マップ is home: opening the app should show where you are, not an
 * empty field. Writing is one tap away and keeps the second position.
 */
export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="map"
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.cream },
      }}
    >
      <Tabs.Screen name="map" options={{ title: '方向性マップ' }} />
      <Tabs.Screen name="log" options={{ title: '入力' }} />
      <Tabs.Screen name="list" options={{ title: '足跡データ' }} />
      <Tabs.Screen name="settings" options={{ title: 'マイページ' }} />
    </Tabs>
  );
}
