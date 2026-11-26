import { createContext, useContext } from 'react';

// Lets any screen open a specific hui in Minutes without passing a function down
// through every component. The dashboard provides it; outside the dashboard it does nothing.
export const OpenHuiContext = createContext(null);
export function useOpenHui() { return useContext(OpenHuiContext); }
