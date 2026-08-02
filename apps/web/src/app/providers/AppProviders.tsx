import type { PropsWithChildren } from 'react';
import { Provider } from 'react-redux';

import { appStore, type AppStore } from '../store';

export function AppProviders({
  children,
  store = appStore,
}: PropsWithChildren<{ store?: AppStore }>): React.JSX.Element {
  return <Provider store={store}>{children}</Provider>;
}
