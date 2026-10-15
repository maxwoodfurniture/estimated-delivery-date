/**
 * <delivery-estimate> custom element.
 * Enhances the server-rendered fallback line with an estimate from the app
 * proxy. Result codes mirror ESTIMATE_CODES in app/services/delivery-estimate.js.
 */
(() => {
  const ELEMENT_NAME = "delivery-estimate";
  if (customElements.get(ELEMENT_NAME)) return;

  const ZIP_PATTERN = /^\d{5}(?:-?\d{4})?$/;
  const STORAGE_KEY = "delivery-estimate:postal-code";
  const CODES = {
    DISABLED: "DISABLED",
    NOT_CONFIGURED: "NOT_CONFIGURED",
    NEEDS_POSTAL_CODE: "NEEDS_POSTAL_CODE",
    INVALID_POSTAL_CODE: "INVALID_POSTAL_CODE",
  };

  const storage = {
    read() {
      try {
        return window.localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    },
    write(value) {
      try {
        window.localStorage.setItem(STORAGE_KEY, value);
      } catch {
        /* storage unavailable: estimate still works for this page */
      }
    },
    clear() {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* storage unavailable */
      }
    },
  };

  class DeliveryEstimateElement extends HTMLElement {
    connectedCallback() {
      if (this.isInitialized) return;
      this.isInitialized = true;

      this.statusText = this.querySelector("[data-delivery-status-text]");
      this.status = this.querySelector("[data-delivery-status]");
      this.result = this.querySelector("[data-delivery-result]");
      this.dateText = this.querySelector("[data-delivery-date]");
      this.locationButton = this.querySelector("[data-delivery-location]");
      this.form = this.querySelector("[data-delivery-form]");
      this.input = this.form.querySelector("input");
      this.message = this.querySelector("[data-delivery-message]");

      this.locationButton.addEventListener("click", () =>
        this.setFormOpen(this.form.hidden, { focus: true }),
      );
      this.form.addEventListener("submit", (event) => this.handleSubmit(event));

      this.load(storage.read());
    }

    setFormOpen(isOpen, { focus = false } = {}) {
      this.form.hidden = !isOpen;
      this.locationButton.setAttribute("aria-expanded", String(isOpen));
      if (isOpen && focus) this.input.focus();
    }

    showStatus(text) {
      this.statusText.textContent = text;
      this.status.hidden = false;
      this.result.hidden = true;
    }

    showMessage(text) {
      this.message.textContent = text;
      this.message.hidden = !text;
      this.input.setAttribute("aria-invalid", String(!!text));
    }

    handleSubmit(event) {
      event.preventDefault();
      const postalCode = this.input.value.trim();
      if (!ZIP_PATTERN.test(postalCode)) {
        this.showMessage(this.dataset.invalidText);
        return;
      }
      this.showMessage("");
      storage.write(postalCode);
      this.load(postalCode);
    }

    async load(postalCode) {
      this.setAttribute("aria-busy", "true");
      if (this.result.hidden) this.showStatus(this.dataset.loadingText);

      const url = new URL(this.dataset.endpoint, window.location.origin);
      if (postalCode) url.searchParams.set("postalCode", postalCode);

      try {
        const response = await fetch(url, {
          headers: { Accept: "application/json" },
        });
        this.render(await response.json());
      } catch {
        this.showStatus(this.dataset.errorText);
      } finally {
        this.removeAttribute("aria-busy");
      }
    }

    render(data) {
      if (data.success) {
        this.dateText.textContent = data.displayText;
        this.locationButton.textContent = data.location;
        this.status.hidden = true;
        this.result.hidden = false;
        this.setFormOpen(false);
        return;
      }

      switch (data.code) {
        case CODES.DISABLED:
        case CODES.NOT_CONFIGURED:
          this.hidden = true;
          break;
        case CODES.NEEDS_POSTAL_CODE:
          this.showStatus(this.dataset.promptText);
          this.setFormOpen(true);
          break;
        case CODES.INVALID_POSTAL_CODE:
          storage.clear();
          this.showStatus(this.dataset.promptText);
          this.setFormOpen(true);
          this.showMessage(this.dataset.invalidText);
          break;
        default:
          this.showStatus(this.dataset.errorText);
      }
    }
  }

  customElements.define(ELEMENT_NAME, DeliveryEstimateElement);
})();
