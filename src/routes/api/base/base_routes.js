function BaseRoutes(router) {
  this.router = router;

  this.config = () => {
    return this.router;
  };

  this.useMiddleware = false;

  this.use = (...args) => mapRoute(this.router.use, ...args);

  this.get = (path, controller) =>
    mapRoute(this.router.get, path, controller);

  this.post = (path, controller) =>
    mapRoute(this.router.post, path, controller);

  this.put = (path, controller) =>
    mapRoute(this.router.put, path, controller);

  this.delete = (path, controller) =>
    mapRoute(this.router.delete, path, controller);

  const mapRoute = (method, path, ...args) => {
    const routerMethod = method.bind(this.router);
    if (this.useMiddleware) {
      routerMethod(path, this.useMiddleware, ...args);
    } else {
      routerMethod(path, ...args);
    }

    return this;
  };
}

module.exports = BaseRoutes;
