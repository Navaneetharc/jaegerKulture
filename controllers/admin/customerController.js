const User = require('../../models/userSchema');  

const customerInfo = async(req,res)=>{
    try {
        let search = "";
        if(req.query.search){
            search = req.query.search;
        }
        let page = 1;
        if(req.query.page){
            page = parseInt(req.query.page);
        }
        const limit = 3;
        const userData = await User.find({
            isAdmin:false,
            $or:[
                {name:{$regex:".*"+search+".*", $options:"i"}},
                {email:{$regex:".*"+search+".*", $options:"i"}}
            ],
        })
        .limit(limit)
        .skip((page-1)*limit)
        .exec();

        const count = await User.find({
            isAdmin:false,
            $or:[
                {name:{$regex:".*"+search+".*", $options:"i"}},
                {email:{$regex:".*"+search+".*", $options:"i"}}
            ],            
        }).countDocuments();

        const totalPages = Math.ceil(count / limit);

        res.render('customers',{data: userData, count, currentPage: page, limit, search, totalPages});
        
    } catch (error) {
        console.error("Error fetching customer data:",error);
        res.status(500).send("Internal Server Error");
    }
}

const customerBlocked = async(req,res)=>{
    try {
        
        let id = req.query.id;
        const result = await User.updateOne({_id:id},{$set:{isBlocked:true}});

        if (req.app.locals.sessionStore) {
            req.app.locals.sessionStore.all((error, sessions) => {
                if (error) {
                    console.error("Error accessing session store:", error);
                } else {
                    Object.keys(sessions).forEach(sessionId => {
                        const session = sessions[sessionId];
                        if (session.user === id) {
                            req.app.locals.sessionStore.destroy(sessionId, (err) => {
                                if (err) console.error("Error destroying session:", err);
                                else console.log("Session destroyed for blocked user:", id);
                            });
                        }
                    });
                }
            });
        }
        

        res.redirect("/admin/users")

    } catch (error) {

        console.error("Error blocking user:", error);
        res.redirect("/admin/pageerror");
        
    }
}

const customerunBlocked = async (req,res)=>{
    try {
        
        let id = req.query.id;
        console.log("Unblocking user with ID:", id);
        const result = await User.updateOne({_id:id},{$set:{isBlocked:false}});
        console.log("Update result:", result);
        res.redirect("/admin/users")

    } catch (error) {
        
        console.error("Error unblocking user:", error);
        res.redirect("/admin/pageerror");
    }
};

const getAllUsers = async(req,res)=>{
    try {
        let search = "";
        if(req.query.search){
            search = req.query.search;
        }
        const page = parseInt(req.params.page) || 1;
        const limit = 3;
        const userData = await User.find({
            isAdmin:false,
            $or:[
                {name:{$regex:".*"+search+".*", $options:"i"}},
                {email:{$regex:".*"+search+".*", $options:"i"}}
            ],
        })
        .limit(limit*1)
        .skip((page-1)*limit)
        .exec();

        const count = await User.find({
            isAdmin:false,
            $or:[
                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}}
            ],            
        }).countDocuments();

        const totalPages = Math.ceil(count / limit);

        res.render('customers',{
            data: userData, 
            count, 
            currentPage: page, 
            limit, 
            search, 
            totalPages
        });
        
    } catch (error) {
        console.error("Error fetching customer data:",error);
        res.status(500).send("Internal Server Error");
    }
}

module.exports = {

    customerInfo,
    customerBlocked,
    customerunBlocked,
    getAllUsers

}