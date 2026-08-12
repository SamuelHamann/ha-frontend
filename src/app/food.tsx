import { EmbeddedWebApp } from '@/components/embedded-web-app';
import { EMBEDDED_APPS } from '@/config/embedded-apps';

export default function FoodScreen() {
  return <EmbeddedWebApp uri={EMBEDDED_APPS.food} />;
}
