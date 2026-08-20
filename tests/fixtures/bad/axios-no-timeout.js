import axios from 'axios';

export async function getInvoice(id) {
  const res = await axios.get(`https://billing.example.com/invoices/${id}`);
  return res.data;
}

export async function chargeCard(payload) {
  return axios.post('https://payments.example.com/charge', payload);
}
