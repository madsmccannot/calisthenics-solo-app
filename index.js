import { registerRootComponent } from 'expo';
import React from 'react';

import App from './App';
import { I18nProvider } from './src/i18n/I18nContext';

// Wrap the app in the i18n provider so every screen can translate.
function Root() {
  return (
    <I18nProvider>
      <App />
    </I18nProvider>
  );
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Root);
