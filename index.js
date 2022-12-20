const express = require("express");
const cors = require("cors");
const jwt = require('jsonwebtoken');
require("dotenv").config();

const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = process.env.PORt || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kpsrg5b.mongodb.net/?retryWrites=true&w=majority`;

// console.log(uri)


function verifiJWT(req, res, next){
  const authHeader = req.headers.authorization;
  if(!authHeader){
    return res.status(401).send({message:'Un Authoriza Access'})
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decode){
    if(err){
      return res.status(403).send({message:'Forbidden Access'})
    }
    req.decode = decode
    next()
  })
}

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    // console.log('database')

    const serviceCollection = client.db("doctors_portal").collection("services");
    const bookingCollection = client.db("doctors_portal").collection("bookings");
    const userCollection = client.db("doctors_portal").collection("users");

    app.get("/service", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query).project({name : 1});
      const services = await cursor.toArray();
      res.send(services);
    });
// all users

    app.get('/user', verifiJWT, async (req, res)=>{
      const users =   await userCollection.find().toArray();
      res.send(users)
    })


    app.get('/admin/:email', async(req, res)=>{
      const email = req.params.email;
      const user = await userCollection.findOne({email:email});
      const isAdmin = user.role === 'admin';
      res.send({admin : isAdmin})
    })
    // user put
    app.put('/user/:email', async(req, res)=>{
      const email = req.params.email;
      const user = req.body;
      const filter ={email:email};
      const option = {upsert:true};
      const updateDoc = {
        $set:user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, option);
      const token = jwt.sign({email:email}, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({result, token});
    })


    // User Make  Admin 

    app.put('/user/admin/:email', verifiJWT, async(req, res)=>{
      const email = req.params.email;
      const requester = req.decode.email;
      const requesterAccount = await userCollection.findOne({email:requester})
      if(requesterAccount.role === 'admin'){
        const filter ={email:email};
      const updateDoc = {
        $set:{role:'admin'},
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
      }
      else{
        res.status(403).send({message:'forbidden'});
      }
      
    })

    // Admin booking
    app.get("/booking", verifiJWT,  async (req, res) => {
      const patient = req.query.patient;
      const decodeEmail = req.decode.email;
      if(patient === decodeEmail){
        const query = { patient: patient };
        const bookings = await bookingCollection.find(query).toArray();
         return res.send(bookings);
      }
      else{
        return res.status(403).send({message:'forbidden Access'});
      }
    
    });

    //Services Booking
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        treatment: booking.treatment,
        date: booking.date,
        patient: booking.patient,
      };
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, result });
    });

    app.get("/available", async (req, res) => {
      const date = req.query.date;
      const services = await serviceCollection.find().toArray();
      const query = { date: date };
      const bookings = await bookingCollection.find(query).toArray();
      services.forEach((service) => {
        const serviceBookings = bookings.filter(
          (book) => book.treatment === service.name
        );
        const bookedSlots = serviceBookings.map((book) => book.slot);

        const available = service.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        service.slots = available;
      });
      res.send(services);
    });

    /***
     * API Naming Convertion
     * app.get('/booking') get all bookings
     * app.get('/booking/:id')
     * app.post('/booking')add new
     * app.patch('/booking/:id')
     * app.delete('/booking/:id')
     **/

    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Hello From Doctor Protal Website!");
});

app.listen(port, () => {
  console.log(`Doctors App listening on port ${port}`);
});
