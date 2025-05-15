const Order           = require('../../models/orderSchema');
const generateInvoice = require('../../config/invoices');

const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('userId', 'name')
      .populate('orderItems.product', 'productName')
      .populate('address.addressDocId');   s

    if (!order) {
      return res.status(404).send('Order not found');
    }

    const allowed = ['Order Confirmed','Order Shipped','Delivered'];
    if (!allowed.includes(order.status)) {
      return res
        .status(403)
        .send('Invoice only available once order is confirmed.');
    }

    const addressDoc = order.address.addressDocId;
    if (!addressDoc) {
      return res.status(400).send('No address record attached to this order.');
    }

    const addrDetail = addressDoc.details.id(order.address.addressDetailId);
    if (!addrDetail) {
      return res.status(400).send('Address detail not found for this order.');
    }

    const formattedAddress = [
      addrDetail.name,
      addrDetail.addressLine1,
      addrDetail.addressLine2,
      `${addrDetail.city}, ${addrDetail.state} ${addrDetail.pincode}`,
      addrDetail.landmark ? `Landmark: ${addrDetail.landmark}` : '',
      `Phone: ${addrDetail.phone}`,
      addrDetail.altPhone ? `Alt Phone: ${addrDetail.altPhone}` : ''
    ].filter(Boolean).join('\n');

    const formattedOrder = {
      _id:          order.orderId,
      customerName: order.userId.name,
      address:      formattedAddress,
      date:         order.createdAt.toLocaleDateString(),
      items: order.orderItems.map(i => ({
                name:     i.product.productName,
                size:     i.variant?.size || 'N/A',
                quantity: i.quantity,
                price:    i.price
            })),
      total:        order.totalAmount
    };

    generateInvoice(formattedOrder, res);

  } catch (err) {
    console.error('Error generating invoice:', err);
    res.status(500).send('Internal Server Error');
  }
};

module.exports = { downloadInvoice };
