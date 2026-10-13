/**
 * Naye template ke shuru ke namoone (EN + AR). User inhe editor mein jaise chahe badle.
 * Field ka label UI ki zubaan mein (t) — sirf editor mein dikhta hai; letter mein asal value aati hai.
 */
import { LetterCategory } from './rb.models';

export type StarterKey = 'blank' | 'experience' | 'salary' | 'employment' | 'noc';
export const STARTERS: readonly StarterKey[] = ['blank', 'experience', 'salary', 'employment', 'noc'];
export const STARTER_CATEGORY: Record<StarterKey, LetterCategory> = {
  blank: 'Other', experience: 'Experience', salary: 'Salary', employment: 'Employment', noc: 'NoObjection'
};

type T = (key: string) => string;

export function starterHtml(key: StarterKey, lang: 'en' | 'ar', t: T): string {
  if (key === 'blank') return '';
  const f = (field: string, format = '') =>
    `<span data-field="${field}"${format ? ` data-format="${format}"` : ''} data-label="${esc(t('rb.f.' + field))}">«${esc(t('rb.f.' + field))}»</span>`;
  const end = lang === 'ar' ? 'left' : 'right';
  const head = lang === 'ar'
    ? `<p style="text-align: ${end}">الرقم المرجعي: ${f('letter.ref')}<br>التاريخ: ${f('letter.date')}</p>`
    : `<p style="text-align: ${end}">Ref: ${f('letter.ref')}<br>Date: ${f('letter.date')}</p>`;
  const sign = lang === 'ar'
    ? `<p>وتفضلوا بقبول فائق الاحترام،</p><p><strong>${f('letter.signatoryName')}</strong><br>${f('letter.signatoryTitle')}<br>${f('company.legalName')}</p>`
    : `<p>Yours sincerely,</p><p><strong>${f('letter.signatoryName')}</strong><br>${f('letter.signatoryTitle')}<br>${f('company.legalName')}</p>`;
  const repeatLabel = esc(t('rb.f.pay.earnings'));
  const payTable = lang === 'ar'
    ? `<table><tbody><tr><th><p>البند</p></th><th><p>المبلغ</p></th></tr>`
      + `<tr data-repeat="pay.earnings" data-label="${repeatLabel}"><td><p>${f('item.name')}</p></td><td><p>${f('item.amount')}</p></td></tr>`
      + `<tr><td><p><strong>إجمالي الراتب الشهري</strong></p></td><td><p><strong>${f('pay.gross')}</strong></p></td></tr></tbody></table>`
    : `<table><tbody><tr><th><p>Component</p></th><th><p>Amount</p></th></tr>`
      + `<tr data-repeat="pay.earnings" data-label="${repeatLabel}"><td><p>${f('item.name')}</p></td><td><p>${f('item.amount')}</p></td></tr>`
      + `<tr><td><p><strong>Total monthly salary</strong></p></td><td><p><strong>${f('pay.gross')}</strong></p></td></tr></tbody></table>`;

  const body: Record<Exclude<StarterKey, 'blank'>, { en: string; ar: string }> = {
    experience: {
      en: `<h2 style="text-align: center">EXPERIENCE CERTIFICATE</h2><p>To whom it may concern,</p>`
        + `<p>This is to certify that ${f('employee.title')} ${f('employee.fullName')} (employee no. ${f('employee.code')}) worked with ${f('company.legalName')} as ${f('job.position')} in the ${f('job.department')} department from ${f('employee.joiningDate')} to ${f('employee.exitDate')}, a total service of ${f('employee.service')}.</p>`
        + `<section data-if="employee.exitReason" data-op="notempty" data-label="${esc(t('rb.f.employee.exitReason'))}"><p>Reason for leaving: ${f('employee.exitReason')}.</p></section>`
        + `<p>During this period ${f('employee.heShe')} showed dedication and professionalism. We wish ${f('employee.title')} ${f('employee.lastName')} every success in the future.</p>`
        + `<p>This certificate is issued at the employee's request without any liability on the company.</p>`,
      ar: `<h2 style="text-align: center">شهادة خبرة</h2><p>إلى من يهمه الأمر،</p>`
        + `<p>تشهد ${f('company.legalName')} بأن ${f('employee.titleAr')} ${f('employee.fullName')} (الرقم الوظيفي ${f('employee.code')}) قد عمل لديها بوظيفة ${f('job.position')} في إدارة ${f('job.department')} خلال الفترة من ${f('employee.joiningDate')} إلى ${f('employee.exitDate')}، بمدة خدمة إجمالية ${f('employee.service')}.</p>`
        + `<section data-if="employee.exitReason" data-op="notempty" data-label="${esc(t('rb.f.employee.exitReason'))}"><p>سبب انتهاء الخدمة: ${f('employee.exitReason')}.</p></section>`
        + `<p>وقد أُعطيت هذه الشهادة بناءً على طلبه دون أدنى مسؤولية على الشركة، مع تمنياتنا له بالتوفيق.</p>`
    },
    salary: {
      en: `<h2 style="text-align: center">SALARY CERTIFICATE</h2><p>To whom it may concern,</p>`
        + `<p>This is to certify that ${f('employee.title')} ${f('employee.fullName')} (employee no. ${f('employee.code')}), nationality ${f('employee.nationality')}, has been working with ${f('company.legalName')} since ${f('employee.joiningDate')} and currently holds the position of ${f('job.position')}.</p>`
        + `<p>The monthly salary of ${f('employee.title')} ${f('employee.lastName')} is as follows (${f('pay.currency')}):</p>${payTable}`
        + `<p>Total monthly salary in words: ${f('pay.gross', 'words')}.</p>`
        + `<section data-if="pay.bankName" data-op="notempty" data-label="${esc(t('rb.f.pay.bankName'))}"><p>The salary is transferred to ${f('pay.bankName')}, IBAN ${f('pay.iban')}.</p></section>`
        + `<p>This certificate is issued at the employee's request for the purpose of ${f('letter.purpose')}, without any liability on the company.</p>`,
      ar: `<h2 style="text-align: center">شهادة راتب</h2><p>إلى من يهمه الأمر،</p>`
        + `<p>تشهد ${f('company.legalName')} بأن ${f('employee.titleAr')} ${f('employee.fullName')} (الرقم الوظيفي ${f('employee.code')})، الجنسية ${f('employee.nationality')}، يعمل لديها منذ ${f('employee.joiningDate')} بوظيفة ${f('job.position')}.</p>`
        + `<p>ويتقاضى راتباً شهرياً على النحو التالي (${f('pay.currency')}):</p>${payTable}`
        + `<p>إجمالي الراتب كتابةً: ${f('pay.gross', 'words')}.</p>`
        + `<section data-if="pay.bankName" data-op="notempty" data-label="${esc(t('rb.f.pay.bankName'))}"><p>ويُحوَّل الراتب إلى ${f('pay.bankName')}، رقم الآيبان ${f('pay.iban')}.</p></section>`
        + `<p>وقد أُعطيت هذه الشهادة بناءً على طلبه لغرض ${f('letter.purpose')}، دون أدنى مسؤولية على الشركة.</p>`
    },
    employment: {
      en: `<h2 style="text-align: center">EMPLOYMENT CERTIFICATE</h2><p>To whom it may concern,</p>`
        + `<p>This is to certify that ${f('employee.title')} ${f('employee.fullName')} (employee no. ${f('employee.code')}) is a ${f('employee.employmentType')} employee of ${f('company.legalName')} since ${f('employee.joiningDate')}.</p>`
        + `<p>${f('employee.title')} ${f('employee.lastName')} currently works as ${f('job.position')} in the ${f('job.department')} department at our ${f('job.location')} office.</p>`
        + `<p>This certificate is issued at the employee's request for the purpose of ${f('letter.purpose')}.</p>`,
      ar: `<h2 style="text-align: center">شهادة تعريف بالعمل</h2><p>إلى من يهمه الأمر،</p>`
        + `<p>تشهد ${f('company.legalName')} بأن ${f('employee.titleAr')} ${f('employee.fullName')} (الرقم الوظيفي ${f('employee.code')}) يعمل لديها منذ ${f('employee.joiningDate')}.</p>`
        + `<p>ويشغل حالياً وظيفة ${f('job.position')} في إدارة ${f('job.department')} بمكتب ${f('job.location')}.</p>`
        + `<p>وقد أُعطيت هذه الشهادة بناءً على طلبه لغرض ${f('letter.purpose')}.</p>`
    },
    noc: {
      en: `<h2 style="text-align: center">NO OBJECTION CERTIFICATE</h2><p>To whom it may concern,</p>`
        + `<p>${f('company.legalName')} confirms that ${f('employee.title')} ${f('employee.fullName')} (employee no. ${f('employee.code')}), working with us as ${f('job.position')} since ${f('employee.joiningDate')}, is a current employee.</p>`
        + `<p>We have no objection to ${f('employee.hisHer')} request for ${f('letter.purpose')}.</p>`
        + `<p>This letter carries no financial or legal liability on the company.</p>`,
      ar: `<h2 style="text-align: center">شهادة عدم ممانعة</h2><p>إلى من يهمه الأمر،</p>`
        + `<p>تفيد ${f('company.legalName')} بأن ${f('employee.titleAr')} ${f('employee.fullName')} (الرقم الوظيفي ${f('employee.code')})، الذي يعمل لديها بوظيفة ${f('job.position')} منذ ${f('employee.joiningDate')}، لا يزال على رأس العمل.</p>`
        + `<p>ولا مانع لدينا من ${f('letter.purpose')}.</p>`
        + `<p>ولا يترتب على هذه الشهادة أي التزام مالي أو قانوني على الشركة.</p>`
    }
  };
  return head + body[key][lang] + sign;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
