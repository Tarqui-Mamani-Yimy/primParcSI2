import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  BillingCycle,
  CheckoutRequest,
  CheckoutResponse,
  PortalResponse,
  PublicPlan,
  PublicSignupRequest,
  PublicSignupResponse,
} from '../models';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

@Injectable({
  providedIn: 'root'
})
export class BillingService {
  constructor(private http: HttpClient) {}

  /**
   * Generates a Stripe Checkout session URL for subscription billing.
   * On success, caller redirects full-page via window.location.href = res.url.
   * If already active, API returns 409 billing_already_active.
   */
  createCheckoutSession(codigoPlan: string, ciclo: BillingCycle = 'mensual'): Observable<CheckoutResponse> {
    const payload: CheckoutRequest = { codigoPlan, ciclo };
    return this.http.post<CheckoutResponse>(`${API_URL}/api/billing/checkout`, payload);
  }

  /**
   * Generates a Stripe Customer Portal session URL.
   * Used for plan changes, card updates and cancellation.
   * On success, caller redirects full-page via window.location.href = res.url.
   * If no Stripe customer exists, API returns 409 billing_not_configured.
   */
  createPortalSession(): Observable<PortalResponse> {
    return this.http.post<PortalResponse>(`${API_URL}/api/billing/portal`, {});
  }

  /**
   * Retrieves public subscription plans and pricing for the landing page.
   */
  getPublicPlans(): Observable<PublicPlan[]> {
    return this.http.get<PublicPlan[]>(`${API_URL}/api/public/plans`);
  }

  /**
   * Self-service signup from the landing page.
   * Validates email, creates Stripe Checkout session with metadata, and returns checkout url.
   * On payment, backend creates the company, admin, subscription and sends welcome email.
   */
  publicSignup(payload: PublicSignupRequest): Observable<PublicSignupResponse> {
    return this.http.post<PublicSignupResponse>(`${API_URL}/api/public/signup`, payload);
  }
}
