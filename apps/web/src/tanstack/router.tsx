import React from 'react';

const TanStackRouterDevtools =
  // eslint-disable-next-line n/no-process-env
  process.env.NODE_ENV === 'production'
    ? () => null
    : React.lazy(() =>
        import('@tanstack/router-devtools').then((res) => ({
          default: res.TanStackRouterDevtools,
        })),
      );

export default TanStackRouterDevtools;
