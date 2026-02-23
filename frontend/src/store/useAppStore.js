import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAppStore = create(
    persist(
        (set) => ({
            sidebarOpen: true,
            themeMode: 'light',
            toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
            toggleTheme: () => set((state) => ({ themeMode: state.themeMode === 'light' ? 'dark' : 'light' })),
        }),
        {
            name: 'firebird-app-storage', // name of the item in the storage (must be unique)
            partialize: (state) => ({ sidebarOpen: state.sidebarOpen, themeMode: state.themeMode }),
        }
    )
);

export default useAppStore;
