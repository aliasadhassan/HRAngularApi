# HrUi

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.0.4.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

touch README.md

node -v
npm -v
npm install -g @angular/cli
npm install jwt-decode
===============================
ng version
===============================
Angular CLI       : 21.0.4
Node.js           : 22.17.1
Package Manager   : npm 10.9.2
Operating System  : win32 x64
===============================
ng generate component auth/login
ng generate component auth/register
ng generate service auth/auth
ng generate component dashboard
ng generate interceptor auth

ng generate component layout/dashboard-layout --standalone
ng generate component shared/sidebar --standalone
ng generate component shared/topbar --standalone
ng generate component shared/widgets --standalone

ng generate component pages/dashboard --standalone
ng generate component pages/employees --standalone
ng generate component pages/attendance --standalone
ng generate component pages/leaves --standalone
ng generate component pages/settings --standalone

ng generate guard auth/auth.guard
-- note : select canActivate

ng generate component shared/widgets/kpi-cards --standalone
ng generate interceptor token

npm install bootstrap-icons
npm install lucide-angular

ng generate component auth/forgot-password
ng generate component auth/reset-password

npm install @zxcvbn-ts/core @zxcvbn-ts/language-en @zxcvbn-ts/language-common