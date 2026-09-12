import { Redirect } from 'expo-router';

/**
 * Home is 方向性マップ, and it opens on 現在地.
 *
 * Opening the app should answer "where am I" before it asks for anything.
 * Writing is one tap away in the second position.
 */
export default function Index() {
  return <Redirect href="/map" />;
}
