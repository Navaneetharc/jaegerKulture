const PDFDocument = require('pdfkit');
const path        = require('path');

function generateInvoice(order, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  
    try {
    doc.image(path.join(__dirname, '../assets/imgs/theme/jaeger.png'), 50, 45, { width: 50 });
  } catch (e) {}
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .text('JaegerKulture', 110, 57)
    .fontSize(10)
    .font('Helvetica')
    .text('www.jaegerkulture.com', 200, 65, { align: 'right' })        
    .moveDown();

  doc.moveTo(50, 100).lineTo(550, 100).stroke();

  const metaTop = 120;
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('Invoice No.:', 50, metaTop)
    .text('Date:', 300, metaTop);

  doc
    .font('Helvetica')
    .text(`#${order._id}`, 150, metaTop)
    .text(order.date, 350, metaTop);

  const billTop = metaTop + 30;
  doc
    .font('Helvetica-Bold')
    .text('Bill To:', 50, billTop);
  doc
    .font('Helvetica')
    .text(order.customerName, 110, billTop)
    .text(order.address, 110, billTop + 15);

  const addressLines = order.address.split('\n').length;
  const tableTop = billTop + 30 + addressLines * 15;

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('Item',       50,  tableTop)
    .text('Size',       260, tableTop, { width: 60, align: 'center' })
    .text('Qty',        340, tableTop, { width: 50, align: 'right' })
    .text('Price',      410, tableTop, { width: 70, align: 'right' })
    .text('Line Total', 490, tableTop, { width: 70, align: 'right' });

  let y = tableTop + 20;
  order.items.forEach(item => {
    doc
      .font('Helvetica')
      .fontSize(12)
      .text(item.name, 50, y, { width: 200 })
      .text((item.size || '').toUpperCase(), 260, y, { width: 60, align: 'center' })
      .text(item.quantity, 340, y, { width: 50, align: 'right' })
      .text(`Rs.${item.price}`, 410, y, { width: 70, align: 'right' })
      .text(
        `Rs.${(item.price * item.quantity).toFixed(2)}`,
        490, y, { width: 70, align: 'right' }
      );
    y += 20;
  });

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(`Total: Rs.${order.total.toFixed(2)}`, 0, y + 30, {
      align: 'right',
      width: 500
    });

  res.setHeader(
    'Content-Disposition',
    `attachment; filename=invoice-${order._id}.pdf`
  );
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);
  doc.end();
}

module.exports = generateInvoice;
