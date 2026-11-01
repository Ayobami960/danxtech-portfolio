type Navigate = (path: string, options?: { replace?: boolean }) => void;

let navigateFn: Navigate | null = null;

export const setNavigate = (navigate: Navigate): void => {
  navigateFn = navigate;
};

export const navigateTo = (path: string, options?: { replace?: boolean }): void => {
  navigateFn?.(path, options);
};
