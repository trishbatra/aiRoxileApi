const express = require("express")
const { connectToMongo } = require("./db")
const axios = require('axios');
const Product = require("./models/data");
const app = express()
const port = 3000

connectToMongo()

app.get("/seed", async (req,res)=>{
    try {
        const ress = await axios.get(`https://s3.amazonaws.com/roxiler.com/product_transaction.json`)
        const theData = ress.data.map(item => ({
            id: item.id,
            title: item.title,
            price: item.price,
            description: item.description,
            category: item.category,
            image: item.image,
            sold: item.sold,
            dateOfSale: new Date(item.dateOfSale)
          }));
          await Product.insertMany(theData);
          res.send('data inserted successfully!');
    } catch (error) {
        console.log(error)
    }
})
function getMonthNumber(month) {
  const monthMap = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12'
  };

  const formattedMonth = month.toLowerCase().slice(0, 3);
  return monthMap[formattedMonth];
}
function caps(str){
  const capitalized = str.charAt(0).toUpperCase() + str.slice(1);
  return capitalized
}
function getMonthNumber2(month) {
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];
  
  const monthIndex = monthNames.indexOf( caps( month));
  if (monthIndex === -1) {
    throw new Error(`Invalid month: ${month}`);
  }
  
  return monthIndex + 1;
}
app.get("/statistics", async (req, res) => {
    const  month  = req.query.month;
    try {
      const pipeline = [
        {
          $match: {
            $expr: {
              $eq: [{ $month: "$dateOfSale" }, getMonthNumber2(month)],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalSaleAmount: { $sum: "$price" },
            totalSoldItems: { $sum: 1 },
            totalNotSoldItems: {
              $sum: {
                $cond: { if: "$sold", then: 0, else: 1 },
              },
            },
          },
        },
      ];
      const result = await Product.aggregate(pipeline);
      res.status(200).json(result[0]);
      console.log(result)
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Something went wrong" });
    }
  });
  app.get("/pie-chart/:month", async (req, res) => {
    try {
      const month = req.params.month;
      const startOfMonth = new Date(`2000-${getMonthNumber(month)}-01T00:00:00Z`);
      // const startOfMonth = new Date(`2000-${getMonthNumber( month)}-01T00:00:00Z`);
      console.log(startOfMonth)
      const endOfMonth = new Date(`2025-${getMonthNumber( month)}-31T23:59:59Z`);
      
      const result = await Product.aggregate([
        {
          $match: {
            dateOfSale: {
              $gte: startOfMonth,
              $lte: endOfMonth
            }
          }
        },
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 }
          }
        }
      ]);
      
      res.json(result);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: `error` });
    }
  });
  app.get('/bar-chart/:month', async (req, res) => {
    try {
      const month = req.params.month;
      const startOfMonth = new Date(`2021-${getMonthNumber(month)}-01T00:00:00Z`);
      console.log(startOfMonth)
      const endOfMonth = new Date(`2023-${getMonthNumber( month )  }-31T23:59:59Z`);
      console.log(endOfMonth)
      const products = await Product.find({
        dateOfSale: {
          $gte: startOfMonth,
          $lt: endOfMonth
        }
      });
  
      const priceRanges = [
        { range: '0-100', min: 0, max: 100 },
        { range: '101-200', min: 101, max: 200 },
        { range: '201-300', min: 201, max: 300 },
        { range: '301-400', min: 301, max: 400 },
        { range: '401-500', min: 401, max: 500 },
        { range: '501-600', min: 501, max: 600 },
        { range: '601-700', min: 601, max: 700 },
        { range: '701-800', min: 701, max: 800 },
        { range: '801-900', min: 801, max: 900 },
        { range: '901-above', min: 901, max: Infinity }
      ];
  
      const chartData = {};
  
      for (const range of priceRanges) {
        chartData[range.range] = 0;
      }
  
      for (const product of products) {
        for (const range of priceRanges) {
          if (product.price >= range.min && product.price <= range.max) {
            chartData[range.range]++;
            break;
          }
        }
      }
  
      res.json({ chartData });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  app.get('/combined-data/:month', async (req, res) => {
    try {
      const {month} = req.params
      const [barChartResponse, lineChartResponse, pieChartResponse] = await Promise.all([
        axios.get(`http://localhost:3000/statistics?month=${month}`),
        axios.get(`http://localhost:3000/pie-chart/${month}`),
        axios.get(`http://localhost:3000/bar-chart/${month}`)
      ]);
      const combinedResponse = {
        barChart: barChartResponse.data,
        lineChart: lineChartResponse.data,
        pieChart: pieChartResponse.data
      };
  
      res.json(combinedResponse);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
app.listen(port, ()=>{
    console.log("HI")
})