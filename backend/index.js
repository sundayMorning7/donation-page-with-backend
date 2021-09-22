const express = require('express');
const cors = require('cors');
const axios = require('axios');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

// init config file with environment variables
if (process.env.NODE_ENV == 'dev') {
  dotenv.config();
}

console.log(process.env.GMAIL_AUTH_LOGIN);

const merchentToken = process.env.MERCHENT_BUSINESS_SANDBOX_TOKEN;
const revolut_api = process.env.MERCHENT_BUSINESS_SANDBOX_URL;

const organizationName = 'organizationName';

const port = 3000;

function sendEmail(to, name, amount) {
  var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_AUTH_LOGIN,
      pass: process.env.GMAIL_AUTH_APP_PASSWORD,
    },
  });

  const text = `
  Date
  Name
  Organization
  Street
  City, state/provice Zip/postal code

  Salutation,

  ${name}, Thank you so much for your generous donation of £${amount} to ${organizationName}! We truly appreciate your commitment to [people server, cause].

  [Image of impact]

  With your help we've [short impact statement].

  Sincerely,
  ${organizationName}
  `;

  var mailOptions = {
    from: process.env.GMAIL_AUTH_LOGIN,
    to,
    subject: `${organizationName}: Salutation, ${name}`,
    text,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}

const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // To parse the incoming requests with JSON payloads

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

app.post('/create-order', async (req, res) => {
  var validRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
  payment_data = {
    amount: req.body.amount,
    currency: req.body.currency,
  };

  if (req.body.email.length && req.body.email.match(validRegex)) {
    payment_data['email'] = req.body.email;
  }

  if (req.body['fname'].length >= 2 && req.body['lname'].length >= 2) {
    payment_data['full_name'] = req.body['fname'] + ' ' + req.body['lname'];
  }

  const merchentOrdersUrl = revolut_api + '/1.0/orders';

  const response = await axios({
    method: 'POST',
    url: merchentOrdersUrl,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${merchentToken}`,
    },
    data: payment_data,
  });

  /* customer_id */
  res.send({ ...response.data, ...payment_data });
});

app.post('/cancel-order', async (req, res) => {
  const cancelationPayload = req.body;

  const merchentCancelOrderUrl =
    revolut_api + `/1.0/orders/${cancelationPayload.orderId}/cancel`;

  const response = await axios({
    method: 'POST',
    url: merchentCancelOrderUrl,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${merchentToken}`,
    },
  });
  res.send(response.data);
});

app.post('/confirm-order', async (req, res) => {
  const confirmationPayload = req.body;

  const responsRetrieveOrder = await retrieveOrder(confirmationPayload.orderId);
  if (responsRetrieveOrder.data.customer_id == '') {
    console.log('No customer_id');
    res.send({ status: 400 });
    return;
  }
  const customerResponse = await retrieveCustomer(
    responsRetrieveOrder.data.customer_id
  );

  if (
    responsRetrieveOrder.data.state === 'PENDING' &&
    responsRetrieveOrder.data.customer_id === customerResponse.data.id &&
    customerResponse.data.payments.length > 0
  ) {
    const confirmOrderUrl =
      revolut_api + `/1.0/orders/${confirmationPayload.orderId}/confirm`;

    const responseConfirmTransaction = await axios({
      method: 'POST',
      url: confirmOrderUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchentToken}`,
      },
      data: {
        payment_method_id:
          responsRetrieveOrder.data.payments[0].payment_method.id,
      },
    });
  }

  sendEmail(
    customerResponse.data.email,
    customerResponse.data.full_name,
    responsRetrieveOrder.data.order_amount.value / 100
  );
  res.send({ status: 200 });
});

function retrieveOrder(orderId) {
  const retrieveOrderUrl = revolut_api + `/1.0/orders/${orderId}`;

  return axios({
    method: 'GET',
    url: retrieveOrderUrl,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${merchentToken}`,
    },
  });
}

function retrieveCustomer(customerId) {
  const retrieveCustomerUrl = revolut_api + `/1.0/customers/${customerId}`;

  return axios({
    method: 'GET',
    url: retrieveCustomerUrl,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${merchentToken}`,
    },
  });
}
