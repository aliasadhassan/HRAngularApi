import { inject } from '@angular/core';
import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { LoaderService } from '../services/loader/loader';

/** Lambi calls jo apni progress khud dikhati hain (AI jawab) — poora page blur na ho. */
export const SKIP_LOADER = new HttpContextToken<boolean>(() => false);

export const loaderInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_LOADER)) return next(req);

  const loader = inject(LoaderService);

  loader.show();

  return next(req).pipe(
    finalize(() => loader.hide())
  );
};
