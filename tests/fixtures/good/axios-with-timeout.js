import axios from 'axios';

export async function getInvoice(id) {
  const res = await axios.get(`https://billing.example.com/invoices/${id}`, {
    timeout: 3000,
  });
  return res.data;
}

export async function chargeCard(payload) {
  return axios.post('https://payments.example.com/charge', payload, { timeout: 3000 });
}

export async function pingHealth() {
  return axios({ url: 'https://svc.example.com/health', timeout: 2000 });
}
