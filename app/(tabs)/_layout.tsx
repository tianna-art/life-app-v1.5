import Tabs from 'expo-router/js-tabs';
import { BottomMuseumNav } from '@components/navigation/BottomMuseumNav';
import { colors } from '@/theme';

/** MAP | LOG | LIST. LOG is the home tab. */
export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="log"
      tabBar={(props) => <BottomMuseumNav {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.ink },
      }}
    >
      <Tabs.Screen name="map" options={{ title: 'MAP' }} />
      <Tabs.Screen name="log" options={{ title: 'LOG' }} />
      <Tabs.Screen name="list" options={{ title: 'LIST' }} />
    </Tabs>
  );
}
