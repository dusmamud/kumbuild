import { buttonPrimaryClass, Card, Field, inputClass, PageTitle } from "@/components/ui";

// Support — home.kumbuild.com/support.
// Admin ko message karo, preview pe feedback do (MOCK: message kahin
// save/send nahi hota — backend aane pe yahan chat aayega).
export default function SupportPage() {
  return (
    <div>
      <PageTitle
        title="Support"
        subtitle="Admin ko message karo — preview feedback, revision ya koi sawaal."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold">Message karo</h2>
          <form className="mt-4 space-y-4">
            <Field label="Subject">
              <input
                type="text"
                required
                placeholder="Jaise: Preview par ek change chahiye"
                className={inputClass}
              />
            </Field>
            <Field label="Message">
              <textarea
                rows={5}
                required
                placeholder="Apna message likho..."
                className={inputClass}
              />
            </Field>
            <button type="submit" className={buttonPrimaryClass}>
              Send message
            </button>
            <p className="text-xs text-muted">
              Mock hai — message abhi kahin send nahi hota. Backend aane pe
              yahan chat aayega.
            </p>
          </form>
        </Card>
        <Card>
          <h2 className="text-lg font-bold">Direct contact</h2>
          <p className="mt-3 text-sm text-muted">
            Jaldi reply chahiye to WhatsApp par message karo — order confirm
            karte time jo number diya tha, wahi use hoga.
          </p>
          <p className="mt-3 text-sm">
            Support hours aur response time launch par announce honge.
          </p>
        </Card>
      </div>
    </div>
  );
}
